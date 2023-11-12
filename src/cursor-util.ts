import type { WriteStream } from 'node:tty'

const isMac = process.env.TERM_PROGRAM === 'Apple_Terminal'
const ESC = '\u001B['
const cursorHide = `${ESC}?25l`
const cursorShow = `${ESC}?25h`
export const cursorSave = isMac ? '\u001B7' : `${ESC}s`
export const cursorRestore = isMac ? '\u001B8' : `${ESC}u`

/**
 * Utility class to hide and show cursor on the terminal and handle potential events.
 */
export class CursorUtil {
  private showCursorCallback: (eventOrExitCode: number | 'SIGINT') => void

  /**
   * Creates a cursor utility.
   * @param stream output stream
   */
  constructor(private readonly stream: WriteStream) {
    this.showCursorCallback = (eventOrExitCode: number | 'SIGINT') => {
      this.stream.write(cursorShow)
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(eventOrExitCode === 'SIGINT' ? 130 : eventOrExitCode)
    }
  }

  /**
   * Hides cursor on the terminal and registers required event handlers.
   */
  hideCursor() {
    this.stream.write(cursorHide)
    process.stdin.resume()
    // @ts-expect-error: event must be 'SIGINT'
    process.addListener('SIGINT', this.showCursorCallback)
    process.addListener('exit', this.showCursorCallback)
  }

  /**
   * Shows cursor on the terminal and unregisters required event handlers.
   */
  showCursor() {
    process.removeListener('exit', this.showCursorCallback)
    process.removeListener('SIGINT', this.showCursorCallback)
    process.stdin.pause()
    this.stream.write(cursorShow)
  }
}
