/**
 * Debounced batch queue for high-volume QR scans.
 * Collects items, flushes on interval or when batch is full.
 */
export function createScanBatchQueue({ flushMs = 80, maxBatch = 20, onFlush }) {
  const queue = [];
  let timer = null;
  let flushing = false;

  const runFlush = async () => {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, maxBatch);
    try {
      await onFlush(batch);
    } finally {
      flushing = false;
      if (queue.length >= maxBatch) {
        void runFlush();
      } else if (queue.length > 0) {
        scheduleFlush();
      }
    }
  };

  const scheduleFlush = () => {
    if (timer || flushing) return;
    timer = setTimeout(() => {
      timer = null;
      void runFlush();
    }, flushMs);
  };

  return {
    enqueue(item) {
      queue.push(item);
      if (queue.length >= maxBatch) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void runFlush();
      } else {
        scheduleFlush();
      }
    },
    async flushPending() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      while (queue.length > 0 || flushing) {
        if (!flushing && queue.length > 0) {
          await runFlush();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
      }
    },
    get pendingCount() {
      return queue.length + (flushing ? 1 : 0);
    },
  };
}
