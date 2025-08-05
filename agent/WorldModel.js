class WorldModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.blocks = {
      A: { on: 'table' },
      B: { on: 'table' },
      C: { on: 'table' }
    };
    this.holding = null;
    console.log("🔄 World model reset to initial state");
  }

  isClear(block) {
    if (block === 'table') return true; // Table can always have blocks placed on it
    return !Object.values(this.blocks).some(b => b.on === block);
  }

  isValidBlock(block) {
    return block === 'table' || this.blocks.hasOwnProperty(block);
  }

  pickup(block) {
    if (!this.isValidBlock(block) || block === 'table') {
      console.log(`❌ Cannot pickup ${block}: invalid block`);
      return false;
    }

    if (!this.blocks[block].on) {
      console.log(`❌ Cannot pickup ${block}: block is already being held`);
      return false;
    }

    if (!this.isClear(block)) {
      console.log(`❌ Cannot pickup ${block}: block is not clear`);
      return false;
    }

    if (this.holding !== null) {
      console.log(`❌ Cannot pickup ${block}: already holding ${this.holding}`);
      return false;
    }

    this.holding = block;
    this.blocks[block].on = null;
    console.log(`✅ Picked up ${block}`);
    return true;
  }

  putdown(block, target) {
    if (!this.isValidBlock(target)) {
      console.log(`❌ Cannot putdown on ${target}: invalid target`);
      return false;
    }

    if (this.holding !== block) {
      console.log(`❌ Cannot putdown ${block}: not currently holding this block`);
      return false;
    }

    if (!this.isClear(target)) {
      console.log(`❌ Cannot putdown on ${target}: target is not clear`);
      return false;
    }

    this.blocks[block].on = target;
    this.holding = null;
    console.log(`✅ Put down ${block} on ${target}`);
    return true;
  }

  unstack(block, from) {
    if (this.blocks[block]?.on !== from) {
      console.log(`❌ Cannot unstack ${block} from ${from}: block is not on ${from}`);
      return false;
    }
    return this.pickup(block);
  }

  // Execute a plan action
  executeAction(action) {
    if (!Array.isArray(action) || action.length < 2) {
      console.log("❌ Invalid action format");
      return false;
    }

    const [actionType, ...params] = action;
    
    switch (actionType) {
      case 'pickup':
        return this.pickup(params[0]);
      case 'putdown':
        return this.putdown(params[0], params[1]);
      case 'unstack':
        return this.unstack(params[0], params[1]);
      default:
        console.log(`❌ Unknown action type: ${actionType}`);
        return false;
    }
  }

  // Method for updating state (used by BdiAgent)
  updateState(action) {
    return this.executeAction(action);
  }

  getBeliefs() {
    return {
      blocks: { ...this.blocks }, // Return a copy to prevent external modification
      holding: this.holding
    };
  }

  // Get a human-readable state description
  getStateDescription() {
    const state = [];
    state.push(`Holding: ${this.holding || 'nothing'}`);
    
    Object.entries(this.blocks).forEach(([block, info]) => {
      state.push(`${block} is on ${info.on}`);
    });
    
    return state.join(', ');
  }
}

module.exports = WorldModel;
