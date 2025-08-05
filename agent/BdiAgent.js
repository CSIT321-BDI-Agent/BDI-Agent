const { generatePlan } = require("./PlanLibrary");

class BdiAgent {
    constructor(beliefs) {
        if (!beliefs) {
            throw new Error("BdiAgent requires a beliefs object");
        }
        this.beliefs = beliefs;
    }

    deliberate(goal) {
        if (!goal || typeof goal !== 'string') {
            console.log("❌ Invalid goal provided");
            return [];
        }

        const beliefState = this.beliefs.getBeliefs();
        const parsedGoal = goal.split(" on ").map(x => x.trim());
        console.log("🧠 Parsed goal:", parsedGoal);
        
        if (parsedGoal.length !== 2) {
            console.log("❌ Invalid goal format. Use 'block1 on block2'");
            return [];
        }

        const plan = generatePlan(beliefState, parsedGoal);
        console.log("📋 Generated plan:", plan);
        return plan;
    }

    updateBeliefs(action) {
        if (!action || !Array.isArray(action) || action.length < 2) {
            console.log("❌ Invalid action format");
            return false;
        }
        
        try {
            return this.beliefs.updateState(action);
        } catch (error) {
            console.log("❌ Error updating beliefs:", error.message);
            return false;
        }
    }
}

module.exports = BdiAgent;
