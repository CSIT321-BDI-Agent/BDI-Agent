class WorldModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.blocks = {
      A: 'table',
      B: 'table',
      C: 'table',
    };
    this.holding = null;
  }

  isClear(block) {
    return !Object.values(this.blocks).includes(block);
  }

  pickup(block) {
    if (this.blocks[block] && this.isClear(block) && this.holding === null) {
      this.holding = block;
      this.blocks[block] = null;
      return true;
    }
    return false;
  }

  putdown(block, target) {
    if (this.holding === block && this.isClear(target)) {
      this.blocks[block] = target;
      this.holding = null;
      return true;
    }
    return false;
  }

  getBeliefs() {
    return {
      blocks: this.blocks,
      holding: this.holding
    };
  }
}

module.exports = WorldModel;
