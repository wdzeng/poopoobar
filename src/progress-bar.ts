import * as util from 'node:util'

import { CursorUtil, cursorRestore, cursorSave } from './cursor-util'
import { EtaTracker } from './eta-tracker'
import { humanizeDuration, humanizeSpeed } from './humanize'

import type { WriteStream } from 'node:tty'

const C_PROCESSED_BAR = '#'
const C_UNPROCESSED_BAR = '-'
const C_COLUMN_SEPARATOR = '|'

/**
 * Minimum progress bar width.
 *
 * @public
 */
export const MIN_BAR_WIDTH = 16

/**
 * Progress bar options.
 *
 * @public
 */
export interface Options {
  /**
   * Progress bar width.
   *
   * @remarks
   * If specified, thia value must be an integer, and at least {@link MIN_BAR_WIDTH}.
   *
   * @defaultValue runtime terminal width
   */
  width?: number

  /**
   * Output stream.
   *
   * @defaultValue `process.stderr`
   */
  output?: WriteStream

  /**
   * Whether to clear the progress bar after stopping.
   *
   * @remarks
   * If {@link Options.bottom} is set to `true`, this option must be `true`.
   *
   * @defaultValue matching {@link Options.bottom}
   */
  clearAfterStop?: boolean

  /**
   * Whether to draw the progress bar at the bottom of the terminal.
   *
   * @defaultValue `false`
   */
  bottom?: boolean

  /**
   * Whether to take actions to prevent the terminal from blinking.
   *
   * @defaultValue `false`
   */
  tryNotToBlink?: boolean
}

enum BarState {
  READY,
  RUNNING,
  STOPPED
}

/**
 * Progress bar.
 *
 * @public
 */
export class ProgressBar {
  private readonly output: WriteStream
  private readonly isTTY: boolean
  private readonly cursorUtil: CursorUtil
  private readonly drawAtBottom: boolean
  private readonly tryNotToBlink: boolean

  private fixedOutputWidth?: number
  private get outputWidth(): number {
    return this.fixedOutputWidth ?? this.output.columns
  }

  private _progress: number
  /**
   * Current progress.
   */
  public get progress(): number {
    return this._progress
  }
  /**
   * Total progress.
   */
  public readonly total: number

  private clearAfterStop: boolean

  private state: BarState = BarState.READY
  private etaUpdateInterval: NodeJS.Timeout | undefined = undefined
  private etaCalculator: EtaTracker | undefined = undefined
  private latestEta: { eta: number; speed: number } | undefined = undefined

  /**
   * Creates a new progress bar.
   *
   * @param total - total progress; must be a positive integer
   * @param options - progress bar options; default to default options
   */
  constructor(total: number, options: Options = {}) {
    if (!Number.isInteger(total)) {
      throw new TypeError('total must be an integer')
    }
    if (total < 1) {
      throw new Error('total must be at least 1')
    }
    if (options.width !== undefined) {
      if (!Number.isInteger(options.width)) {
        throw new TypeError('width must be an integer')
      }
      if (options.width < MIN_BAR_WIDTH) {
        throw new Error(`width must be at least ${MIN_BAR_WIDTH}`)
      }
    }
    if (options.bottom && options.clearAfterStop !== undefined && !options.clearAfterStop) {
      throw new Error('clearAfterStop must be true if bottom is true')
    }

    this._progress = 0
    this.total = total
    this.fixedOutputWidth = options.width
    this.output = options.output ?? process.stderr
    this.isTTY = this.output.isTTY
    this.cursorUtil = new CursorUtil(this.output)
    this.tryNotToBlink = options.tryNotToBlink ?? false
    this.drawAtBottom = options.bottom ?? false
    this.clearAfterStop = options.clearAfterStop ?? this.drawAtBottom
  }

  /**
   * Starts the progress bar.

   * @throws `Error`
   * If the progress bar has already started.
   */
  start(): void {
    if (this.state !== BarState.READY) {
      throw new Error('cannot start() twice')
    }

    if (!this.isTTY) {
      return
    }

    // The tracker is updated per second and the window width is 120, so we are calculating ETA
    // based on the past 120 seconds.
    this.etaCalculator = new EtaTracker(120)
    this.etaUpdateInterval = setInterval(() => {
      // @ts-expect-error: eta calculator is not undefined when we reach here
      this.latestEta = this.etaCalculator.updateProgressAndGetLatestEta(this._progress, this.total)
      this.refresh()
    }, 1000) // Update ETA per second.

    this.cursorUtil.hideCursor()
    this.state = BarState.RUNNING
  }

  private draw(output: string) {
    // TODO: should we redraw the bar if the output is not changed?
    // TODO: the drawing is broken when the terminal width changes. Should detect SIGWINCH.

    if (this.drawAtBottom) {
      // At this moment the cursor is at the position to print the next message. We move the cursor
      // to the bottom, draw the bar, then move back to the original position.
      this.output.write(cursorSave)
      this.output.cursorTo(0, this.output.rows - 1)
      this.output.write(output)
      // In some terminal (e.g. Windows Terminal), the last character is erased when the output
      // width equals to the terminal. So we only erase to right when output width is less than
      // terminal.
      if (output.length < this.outputWidth) {
        this.output.clearLine(1)
      }
      this.output.write(cursorRestore)
    } else {
      // At this moment the cursor is somewhere on the progress bar.
      this.output.cursorTo(0)
      this.output.write(output)
      // In some terminal (e.g. Windows Terminal), the last character is erased when the output
      // width equals to the terminal. So we only erase to right when output width is less than
      // terminal.
      if (output.length < this.outputWidth) {
        this.output.clearLine(1)
      }
    }
  }

  private refresh(): void {
    if (this.outputWidth < MIN_BAR_WIDTH) {
      // If we do not have enough space, draw ########.
      this.draw('#'.repeat(this.outputWidth))
      return
    }

    // The bar looks like this:
    //
    //   [#########====] 333/1000 (33%) | eta 30s | 20 bps
    //   *               0.       1.      2.  3.    4.
    //
    // *. bar section
    // 0. progress and total section
    // 1. percentage section
    // 2. eta text section
    // 3. eta value section
    // 4. speed section
    //
    // We put the bar section at the leftmost, and then render the remaining space with eta value,
    // speed, progress and total, percentage, and eta text, in order.
    let remainingWidth = this.outputWidth - MIN_BAR_WIDTH
    const completeRatio = this._progress / this.total

    let progressAndTotalSection = ''
    let percentageSection = ''
    let etaSection = ''
    let speedSection = ''

    const renderBarSectionAndThenDraw = () => {
      const barWidth = MIN_BAR_WIDTH + remainingWidth - 2
      const processCharCount = Math.floor(barWidth * completeRatio)
      const unprocessedCharCount = barWidth - processCharCount
      const bar = `[${C_PROCESSED_BAR.repeat(processCharCount)}${C_UNPROCESSED_BAR.repeat(
        unprocessedCharCount
      )}]`

      this.draw(bar + progressAndTotalSection + percentageSection + etaSection + speedSection)

      // If the bar is completed, stop the interval.
      if (this.total === this._progress) {
        clearInterval(this.etaUpdateInterval)
      }
    }

    // Add ETA value section. This section requires exactly 6 + 1 spaces.
    if (remainingWidth < 7) {
      renderBarSectionAndThenDraw()
      return
    }
    if (this.latestEta === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.latestEta = this.etaCalculator!.updateProgressAndGetLatestEta(this._progress, this.total)
    }
    const humanizedDuration = humanizeDuration(this.latestEta.eta)
    etaSection = humanizedDuration.padStart(7, ' ')
    remainingWidth -= 7

    // Add progress and total section ("333/1000"). This section requires at least 2 *
    // str(total) + 1 (slash) + 1 (space padding) + 2 (separator before ETA) spaces.
    const progressAndTotalSectionWidth = this.total.toString().length * 2 + 4
    if (remainingWidth < this.total.toString().length * 2 + 4) {
      renderBarSectionAndThenDraw()
      return
    }
    progressAndTotalSection = `${this._progress}/${this.total}`.padStart(
      this.total.toString().length * 2 + 2,
      ' '
    )
    // Append an additional " |" to ETA value section. The ETA value section already has a left
    // space padding, so ne need to append here.
    etaSection = ` ${C_COLUMN_SEPARATOR}${etaSection}`
    remainingWidth -= progressAndTotalSectionWidth

    // Append rate section ("20 bps"). This section requires exactly 13 spaces.
    if (remainingWidth < 13) {
      renderBarSectionAndThenDraw()
      return
    }
    speedSection = ` ${C_COLUMN_SEPARATOR} ${humanizeSpeed(this.latestEta.speed).padStart(10, ' ')}`
    remainingWidth -= 13

    // Add percentage section ("33%"). This section requires exactly 6 spaces.
    if (remainingWidth < 6) {
      renderBarSectionAndThenDraw()
      return
    }
    const percentage = `(${Math.floor(completeRatio * 100)}%)`.padStart(6, ' ')
    percentageSection = percentage
    remainingWidth -= 6

    // Add ETA text (" eta"). This section requires exactly 4 spaces.
    if (remainingWidth < 4) {
      renderBarSectionAndThenDraw()
      return
    }
    etaSection = ` ${C_COLUMN_SEPARATOR} ${`eta ${humanizedDuration}`.padStart(10)}`
    remainingWidth -= 4

    renderBarSectionAndThenDraw()
  }

  /**
   * Logs messages to the terminal.
   *
   * @remarks
   * If the progress bar is not running, this acts as a trivial print.
   *
   * @param format - the same as {@link console.log}
   * @param optionalParams - the same as {@link console.log}
   */
  log(format: string, ...optionalParams: unknown[]): void {
    // Hint: never assume the message is one line. Even if the message is one line, the message may
    // be very long so it occupies more than one row on the terminal.
    const message = util.format(format, ...optionalParams)

    // If this is not a TTY, there is no bar, so just print the message. Also, if the progress bar
    // is not running, we can print the message.
    if (!this.isTTY || this.state !== BarState.RUNNING) {
      this.output.write(message)
      this.output.write('\n')
      return
    }

    // TODO: the progress bar information does not change. Should we call draw() instead of
    // refresh()? What if the terminal size has changed?

    if (this.drawAtBottom) {
      // At this point the cursor is on the right location to print the next message. This location
      // may be the last row.

      if (this.tryNotToBlink) {
        // If we directly print the message and redraw the bar, the terminal may blink (this depends
        // on which terminal is used: VS Code terminal is not affected but Windows Terminal blinks).
        //
        // To solve this problem, we need to reorder what we are to do. First we estimate and move
        // cursor to the new position of the bar, draw the bar, move back, and then print the message.
        //
        // However, we cannot estimate the new position of the bar because we do not know how many
        // rows the message will occupy. So we assume the message is a simple one-line message. In
        // this case the new position of the bar is the next row.

        // TODO: calculate row count the message will occupy (if possible). Now assumed one line.
        this.output.write('\n')
        this.output.moveCursor(0, -1)
        this.output.write(message)
        this.output.clearLine(1)
        this.output.cursorTo(0)
        this.output.moveCursor(0, 1)
        this.refresh()
      } else {
        this.output.write(message)
        this.output.clearLine(1)
        this.output.write('\n')
        this.refresh()
      }
    } else {
      // At this point the cursor is on the progress bar, which is just below the last message.

      // eslint-disable-next-line no-lonely-if
      if (this.tryNotToBlink) {
        // At this moment, the console is like this:
        //
        //   #############################============== (bar / last row) < cursor is at this line
        //
        // If we [1] erase the bar and print the message, [2] go to the next line, and then [3] redraw
        // the bar, the the time gap between [1] and [3] is so long that the terminal will flash. The
        // correct order should be [3] -> [1] -> [2].
        //
        // First, we move the cursor to the next line. This should be done printing a newline rather
        // than moving the cursor, because moving the cursor make have unexpected behavior, such as
        // the some printed message is gone. Then print the bar (step [3] above). So now the console
        // is like:
        //
        //   #############################============ (old bar)
        //   #############################============ (new bar / last row)  < cursor is at this line
        //
        // Now, erase the old bar and print the message (step [1] above). So now the console is like:
        //
        //   hello world! < cursor is at this line
        //   #############################============ (new bar / last row)  < cursor is at this line
        //
        // Finally, we move the cursor to the new bar (step [2] above). Done!
        this.output.write('\n')
        this.refresh()
        this.output.moveCursor(0, -1)
        this.output.cursorTo(0)
        this.output.write(message)
        this.output.clearLine(1)
        this.output.moveCursor(0, 1)
      } else {
        this.output.cursorTo(0)
        this.output.write(message)
        this.output.clearLine(1)
        this.output.write('\n')
        this.refresh()
      }
    }
  }

  /**
   * Increments the progress.
   *
   * @param value - the value to increment; default to 1
   *
   * @throws `Error`
   * If the progress exceeds the total after increment.
   *
   * @throws `Error`
   * If the progress bar is not running.
   */
  tick(value = 1): void {
    if (!Number.isInteger(value)) {
      throw new TypeError('value must be an integer')
    }
    if (value < 1) {
      throw new Error('value must be at least 1')
    }
    if (this.state !== BarState.RUNNING) {
      throw new Error('progress bar is not running')
    }
    if (this._progress + value > this.total) {
      throw new Error(`progress ${this._progress + value} exceeds total ${this.total}`)
    }

    if (!this.isTTY) {
      return
    }

    this._progress += value
    this.refresh()
  }

  /**
   * Stops the progress bar.
   *
   * @remarks
   * If the progress bar has stopped, this method is a no-op.
   *
   * @throws `Error`
   * If the progress bar has not yet started.
   */
  stop(): void {
    if (this.state === BarState.READY) {
      throw new Error('progress bar is not running')
    }

    if (!this.isTTY || this.state === BarState.STOPPED) {
      return
    }

    clearInterval(this.etaUpdateInterval)

    if (this.clearAfterStop) {
      if (this.drawAtBottom) {
        // At this point the cursor is on the right location to print the next message. Therefore we
        // just move to the bottom, clear the bar, and then move back.
        this.output.write(cursorSave)
        this.output.cursorTo(0, this.output.rows - 1)
        this.output.clearLine(1)
        this.output.write(cursorRestore)
      } else {
        // At this point the cursor is on the progress bar, which is just below the last message. So
        // we just clear the bar and move the cursor to the start of line.
        this.output.cursorTo(0)
        this.output.clearLine(1)
      }
    } else {
      // This implies that the progress bar is not at the bottom of the terminal. At this time the
      // cursor is on the progress bar, so we print a line feed so that future messages are printed
      // under the progress bar.
      this.output.write('\n')
    }

    this.cursorUtil.showCursor()
    this.state = BarState.STOPPED
  }
}
