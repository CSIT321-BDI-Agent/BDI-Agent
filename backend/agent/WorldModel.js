// WorldModel.js
// This keeps track of the current state of beliefs of the wolrd from the agents point of view
class WorldModel {
  constructor() {
    // The initial beliefs are that all blocks are on the table and that the agent iis no tholding anyhting
    this.beliefs = {
      blocks: {
        A: "table",
        B: "table",
        C: "table"
      },
      holding: null
    };
  }

  // Below code is to update the wolrd state based on the action that have been performed 
  update(action) {
    const [command, block, target] = action;

    switch (command) {
      case "pickup":
        // This only allows picking up a bloxk if its currently on 
        // something and the agents hand is free
        if (this.beliefs.blocks[block] && this.beliefs.holding === null) {
          this.beliefs.holding = block;
          // The block i snow held by the agent
          this.beliefs.blocks[block] = "arm";
        }
        break;

      case "putdown":
        // Only allows to put down the block if its currently being held
        if (this.beliefs.holding === block) {
          // Puts the block on the target 
          this.beliefs.blocks[block] = target;
          // The hand is now free
          this.beliefs.holding = null;
        }
        break;
    }
  }

  // Below it reurns a copy of the current beliefs that are used when planning

  getBeliefs() {
    return this.beliefs;
  }

  // This below replaces the current beliefs with a new set that is used fpr 
  // restoring the state 

  setBeliefs(newBeliefs) {
    this.beliefs = newBeliefs;
  }


  // Belwo it ensures that blocks exist in the beliefs that is useful for goals that involves unknown blocks
  ensureBlockExists(blockName) {
    if (!this.beliefs.blocks[blockName]) {
      this.beliefs.blocks[blockName] = "table";
    }
  }
}
// Allows to be exported
module.exports = WorldModel;
