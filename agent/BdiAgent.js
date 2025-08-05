const { generatePlan } = require("./PlanLibrary");

class BdiAgent {
    constructor(beliefs) {
        this.beliefs = beliefs;
    }

    deliberate(goal) {
        const beliefState = this.beliefs.getBeliefs();
        const parsedGoal = goal.split(" on ").map(x => x.trim());
        console.log(" Parsed goal:", parsedGoal);
        const plan = generatePlan(beliefState, parsedGoal);
        return plan;
    }

    updateBeliefs(action) {
        this.beliefs.updateState(action);
    }
}

module.exports = BdiAgent;