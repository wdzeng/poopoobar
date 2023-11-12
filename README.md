# PooPooBar

A cool CLI progress bar.

![demo](docs/demo.gif)

- Simple: easy to use.
- Lightweight: no dependency.
- Informative: instant and precise progress, ETA, and speed
- Smart: silent on non-tty.
- TypeScript supported.
- CommonJS/ESM supported.

## Installation

```sh
npm install poopoobar
```

## Usage

A simple example:

```js
import { ProgressBar } from 'poopoobar' // ESM
const { ProgressBar } = require('poopoobar') // commonjs

const bar = new ProgressBar(100)
bar.start()

for (let i=0; i<100; i++) {
  do_task()
  bar.tick()
}
bar.stop()
```

Another example:

```js
import { ProgressBar } from 'poopoobar' // ESM
const { ProgressBar } = require('poopoobar') // commonjs

const bar = new ProgressBar(100, { clearAfterStop: true, width: 80 })
bar.start()

try {
  for (let i=0; i<100; i+=2) {
    bar.log('Start task %d and %d', i, i+1)
    do_two_tasks()
    bar.tick(2)
    bar.log('Task %d and %d finished', i, i+1)
  }
} finally {
  bar.stop()
}
```

## API

- **`class ProgressBar`**

  | Property | Type | Description |
  | -------- | ---- | ----------- |
  | `progress` | `number` | current progress value; guaranteed to be a non-negative integer |
  | `total` | `number` | total progress value; guaranteed to be a positive integer |

- **`ProgressBar(total: number, options?: object)`**

  Creates a progress bar instance.

  | Argument | Type | Description |
  | -------- | ---- | ----------- |
  | `total`  | `number` | total progress; must be a positive integer |
  | `options?` | `object` | progress bar options; default to all default options |
  | `options.width?` | `number` | progress bar width; must be at least 16; default to terminal column count |
  | `options.output?` | [`tty.WriteStream`](https://nodejs.org/api/tty.html#class-ttywritestream) | output stream; default to [`process.stderr`](https://nodejs.org/api/process.html#processstderr) |
  | `options.bottom?` | `boolean` | draw the bar at the terminal bottom; default to `false` |
  | `options.clearAfterStop?` | `boolean` |  clear the bar on terminal after stopping; must be `true` if `bottom` is `true`; default to matching `bottom` |
  | `options.tryNotToBlink?` | `boolean` | take more actions to prevent the terminal frmo blinking; default to `false` |

  You probably don't want to use two progress bars simultaneously, as this can break the drawing.

  If `options.bottom` is `true`, `options.clearAfterStop` must also be `true`. This is because if we
  do not erase the bottom bar after the progress bar stops, the future messages will eventually
  overwrite the bar.

  See [When to `tryNotToBlink`](#when-to-trynottoblink) at the bottom section.

- **`progressBar.start()`**

  Start the progress bar. By this time the progress bar is drawn on the terminal and is refreshed
  periodically. This cannot be called twice.

- **`progressBar.tick(value?: number)`**

  Increase the progress bar `value`. The new progress must not exceed `total`. This must be called
  only after `start()`.

   | Argument | Type | Description |
   | -------- | ---- | ----------- |
   | `value?`  | `number` | progress increment value; must be a non-negative integer; default to `1` |

- **`progressBar.stop()`**

  Stop the progress bar and any drawings. This clears the bar on the terminal if
  `options.clearAfterStop` is set to `true`. This must be called after `start()`. This acts as a
  no-op if called more than once.

  You cannot restart a progress bar after stopping. Use a new progress bar instance in this case.

- **`progressBar.log(format: string, ...arguments: any[])`**

  Print a message. If the progress bar is not running or if this is a non-tty program, it acts as a
  trivial print.

  | Argument | Type | Description |
  | -------- | ---- | ----------- |
  | `format` | `string` | see [`util.format`](https://nodejs.org/api/util.html#utilformatformat-args) |
  | `...arguments` | `any[]` | see [`util.format`](https://nodejs.org/api/util.html#utilformatformat-args) |

  Do not directly call `process.stderr.write` or `console.error` (or write to the bar stream) when
  the progress bar is running, as it can break the drawing.

## When to `tryNotToBlink`

Some terminals may blink when the program frequently draw and erase texts. By enabling
`tryNotToBlink`, the progress bar takes more action to deal with the drawing, which can reduce the
possibility the terminal blinks.

Some terminals (e.g. VS Code integrated terminal) has great rendering techniques. In this case you
do not need to enable this option.

Enabling `tryNotToBlink` has a very critical prerequisite that every message must be one-line only.
Note that a long message which occupies more than on rows on the terminal is not a one-line message.

Follow the following questions if you are not sure whether to enable it:

1. Will you call `log()` method when the progress bar is running?
   - no -> `false`
   - maybe/yes -> goto next question
2. Do you care about terminal blinking?
   - no -> `false`
   - yes -> goto next question
3. Try to set this to `false` and run your program. Does the terminal blink?
   - no -> `false`
   - yes -> goto next question
4. Will there be any long or multiline message?
   - maybe/yes -> `false`
   - no -> `true`
