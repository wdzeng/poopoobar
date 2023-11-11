import type { WriteStream } from 'node:tty'

const ESC = '\u001B['
const cursorHide = `${ESC}?25l`
const cursorShow = `${ESC}?25h`

/**
 * Hides cursor from the terminal.
 * @param stream output stream
 */
export function hideCursor(stream: WriteStream) {
  stream.write(cursorHide)
}

/**
 * Shows cursor on the terminal.
 * @param stream output stream
 */
export function showCursor(stream: WriteStream) {
  stream.write(cursorShow)
}
