// BdiAgent.js
// This generate plan function is brough in so that we can create plans for the agent
const { generatePlan } = require("./PlanLibrary");

// Below is the main class for the BDI agent
class BdiAgent {
  // Here we give the agent a model as it needs to know about the world
  constructor(worldModel) {
    this.worldModel = worldModel;
  }

  // Here is what happens when the goal is goven to stack like A on B
  handleGoal(goal) {
    // Below it is to split the goal string into parts and only care about the block names
    const [block1, , block2] = goal.split(" ");

    // Below it is to make sure that blocks exist in the model 
    this.worldModel.ensureBlockExists(block1);
    this.worldModel.ensureBlockExists(block2);

    // Below block is to gett the current state of where the blocks are
    // and then ask the plan library to make a plan to stack the blocks and return the plan so it can be followed

    const beliefs = this.worldModel.getBeliefs();
    const plan = generatePlan(beliefs, block1, block2);
    return plan;
  }

  applyAction(action) {
    this.worldModel.update(action);
  }

  // This is to reurn what the agent currently believes
  getBeliefs() {
    return this.worldModel.getBeliefs();
  }
}
// make class available to other files for server
module.exports = BdiAgent;
