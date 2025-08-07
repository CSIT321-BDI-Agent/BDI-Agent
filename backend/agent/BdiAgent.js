// BdiAgent.js
const { generatePlan } = require("./PlanLibrary");

class BdiAgent {
  constructor(worldModel) {
    this.worldModel = worldModel;
  }

  handleGoal(goal) {
    const [block1, , block2] = goal.split(" ");

    // Add any missing blocks to beliefs
    this.worldModel.ensureBlockExists(block1);
    this.worldModel.ensureBlockExists(block2);

    const beliefs = this.worldModel.getBeliefs();
    const plan = generatePlan(beliefs, block1, block2);
    return plan;
  }

  applyAction(action) {
    this.worldModel.update(action);
  }

  getBeliefs() {
    return this.worldModel.getBeliefs();
  }
}

module.exports = BdiAgent;
