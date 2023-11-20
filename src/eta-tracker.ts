/**
 * A FIFO data structure with a fixed capacity.
 *
 * @internal
 */
class Queue<T> {
  private readonly capacity: number
  private content: T[]
  private index: number

  /**
   * Creates a queue with a fixed capacity.
   *
   * @param capacity - the capacity of the queue; must be a positive integer
   */
  constructor(capacity: number) {
    if (!Number.isInteger(capacity)) {
      throw new TypeError('capacity must be an integer')
    }
    if (capacity < 1) {
      throw new Error('capacity must be at least 1')
    }
    this.capacity = capacity
    this.index = 0
    this.content = []
  }

  /**
   * Pushes an element into the queue. If the queue is full, the oldest element is popped.
   *
   * @param element - the element to push
   */
  push(element: T) {
    if (this.content.length === this.capacity) {
      this.content[this.index] = element
      if (++this.index === this.capacity) {
        this.index = 0
      }
    } else {
      this.content.push(element)
    }
  }

  /**
   * Queries the oldest element in the queue.
   *
   * @returns the oldest element
   */
  get oldest(): T {
    // The ETA tracker never calls this method when the queue is empty.
    return this.content[this.index]
  }
}

/**
 * A tracker that tracks the ETA of a process.
 *
 * The ETA is calculated using a sliding window, which is collection of past progress and time
 * information. When the user queries the ETA, the tracker compares the current status with the
 * oldest one recorded in the window to calculate the value. The sliding window has a fixed
 * capacity, so when the user records a new data, the oldest data is deleted if the window is full,
 * and the second-oldest data becomes the oldest.
 *
 * @internal
 */
export class EtaTracker {
  private slidingWindow: Queue<{ progress: number; time: number }>

  /**
   * Creates a new tracker.
   *
   * @remarks
   * The tracker immediately starts after the constructor is called.
   *
   * @param slidingWindowWidth - sliding window width
   */
  constructor(slidingWindowWidth: number) {
    this.slidingWindow = new Queue(slidingWindowWidth)
    // When the constructor is called, we assume the process is already started, so push a data.
    // This also implies the window is never empty.
    this.slidingWindow.push({ progress: 0, time: Date.now() })
  }

  /**
   * Updates the latest progress and calculates the ETA.
   *
   * If the total is unknown, the eta is estimated to be infinity.
   *
   * @param currentProgress - current progress
   * @param total - total progress; `null` means unknown
   * @returns latest ETA; speed is in progress per second, eta is in seconds or infinity
   */
  updateProgressAndGetLatestEta(
    currentProgress: number,
    total: number | null
  ): { speed: number; eta: number } {
    const currentTime = Date.now()

    const oldestRecord = this.slidingWindow.oldest
    const timeElapsed = currentTime - oldestRecord.time
    const progressElapsed = currentProgress - oldestRecord.progress

    const speed = (progressElapsed * 1000) / timeElapsed
    // ETA can be infinity when speed is 0. But if total === currentProgress, 0 / 0 === NaN, so do
    // more check.
    let eta: number
    if (total === currentProgress) {
      eta = 0
    } else if (total === null) {
      eta = Number.POSITIVE_INFINITY
    } else {
      eta = (total - currentProgress) / speed
    }

    this.slidingWindow.push({ progress: currentProgress, time: currentTime })
    return { eta, speed }
  }
}
