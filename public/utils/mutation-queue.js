export class MutationQueue {
  constructor() {
    this.items = [];
  }

  add(mutation) {
    if (!mutation || typeof mutation !== 'object') {
      return;
    }
    this.items.push({ ...mutation, timestamp: Date.now() });
  }

  hasItems() {
    return this.items.length > 0;
  }

  drain() {
    if (!this.items.length) {
      return [];
    }
    const drained = [...this.items];
    this.items.length = 0;
    return drained;
  }

  clear() {
    this.items.length = 0;
  }
}
