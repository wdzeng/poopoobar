/**
 * Floors a non-negative number to one decimal.
 *
 * @param f - number to be floored; must be non-negative
 * @returns floored value
 *
 * @internal
 */
function floorToOneDecimal(f: number): string {
  return String(Math.floor(f * 10) / 10)
}

/**
 * Converts a number to a two-character string prefixed with a possible space.
 *
 * @param n - number; must be non-negative integer and at most 99
 * @returns two-character string
 *
 * @internal
 */
function twoChar(n: number): string {
  return n < 10 ? String(n) : ` ${String(n)}`
}

/**
 * Humanizes a speed.
 * @param speed - speed value in progress per second
 * @returns humanized speed; at most 10 characters
 *
 * @internal
 */
export function humanizeSpeed(speed: number): string {
  // It is OK that speed is float number. No need to convert to integer.

  if (speed === 0) {
    // Treat definite 0 as a special case; don't show 0.00 bps as it may be considered as a very
    // slow speed but non-zero speed.
    return '0 bps'
  }

  if (speed < 1000) {
    // 0.00 bps (almost zero but not zero), 9.99 bps, 99.9 bps, 999.9 bps
    return `${speed.toFixed(2)} bps`
  }

  if (speed < 1000 * 1000) {
    // 9.99 kbps, 99.9 kbps, 999.9 kbps
    return `${floorToOneDecimal(speed / 1000)} kbps`
  }

  if (speed < 1000 * 1000 * 1000) {
    // 9.99 mbps, 99.9 mbps, 999.9 mbps
    return `${floorToOneDecimal(speed / (1000 * 1000))} mbps`
  }

  if (speed < 1000 * 1000 * 1000 * 1000) {
    // 9.99 gbps, 99.9 gbps, 999.9 gbps
    return `${floorToOneDecimal(speed / (1000 * 1000 * 1000))} gbps`
  }

  if (speed < 1000 * 1000 * 1000 * 1000 * 100) {
    // 9999 gbps, 99999 gbps
    return `${Math.floor(speed / (1000 * 1000 * 1000))} gbps`
  }

  // The rate is too high and exceeds 10 charters, so treat it as the maximal value.
  return '99999 gbps'
}

/**
 * Humanizes a duration.
 *
 * @param duration - duration in seconds; can be infinity
 * @returns humanized duration; at most 6 characters
 *
 * @internal
 */
export function humanizeDuration(duration: number): string {
  if (duration === 0) {
    // Treat definite zero as a special value. Report a "done" in the progress bar so that the suer
    // knows the all tasks are done. Showing 0s may confuses the user that the process is done or
    // almost done.
    return 'done'
  }

  if (Number.POSITIVE_INFINITY === duration) {
    // Treat infinity as a special value; don't show 99999d as it may be considered that the
    // speed is very slow but non-zero.
    //
    // Infinity often happens when the progress bar just starts.
    return '--'
  }

  // Here duration must be a non-negative float or integer.
  duration = Math.round(duration)

  if (duration < 60) {
    // 59s
    return `${duration}s`
  }

  if (duration < 60 * 60) {
    // 59m 0s, 59m59s
    const second = duration % 60
    const minute = (duration - second) / 60
    return `${minute}m${twoChar(second)}s`
  }

  if (duration < 60 * 60 * 100) {
    // 59h 0s, 59h59s
    const minute = Math.floor(duration / 60) % 60
    const hour = Math.floor(duration / (60 * 60))
    return `${hour}h${twoChar(minute)}m`
  }

  if (duration < 60 * 60 * 24 * 100) {
    // 99d 0h, 99d23h
    const hour = Math.floor(duration / (60 * 60)) % 24
    const day = Math.floor(duration / (60 * 60 * 24))
    return `${day}d${twoChar(hour)}h`
  }

  if (duration < 60 * 60 * 24 * 100000) {
    // 100d, 999d, 9999d, 99999d
    const day = Math.floor(duration / (60 * 60 * 24))
    return `${day}d`
  }

  // The ETA is too high and exceeds 6 characters, so treat it as the maximal value.
  return '99999d'
}
