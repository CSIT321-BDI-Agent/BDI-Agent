// WorldModel.js
class WorldModel {
  constructor() {
    this.beliefs = {
      blocks: {
        A: "table",
        B: "table",
        C: "table"
      },
      holding: null
    };
  }

  update(action) {
    const [command, block, target] = action;

    switch (command) {
      case "pickup":
        if (this.beliefs.blocks[block] && this.beliefs.holding === null) {
          this.beliefs.holding = block;
          this.beliefs.blocks[block] = "arm";
        }
        break;

      case "putdown":
        if (this.beliefs.holding === block) {
          this.beliefs.blocks[block] = target;
          this.beliefs.holding = null;
        }
        break;
    }
  }

  getBeliefs() {
    return this.beliefs;
  }

  setBeliefs(newBeliefs) {
    this.beliefs = newBeliefs;
  }

  ensureBlockExists(blockName) {
    if (!this.beliefs.blocks[blockName]) {
      this.beliefs.blocks[blockName] = "table";
    }
  }
}

module.exports = WorldModel;
