class PlanLibrary {
    createPlan(beliefs, block1, block2) {
        if (!beliefs.blocks[block1] || !beliefs.blocks[block2]) {
            return [];
        }

        if (beliefs.blocks[block1].on === block2) {
            return [];
        }

        const plan = [];

        // Pick up block1 if it's on something
        if (beliefs.blocks[block1].on !== 'table') {
            plan.push(['unstack', block1, beliefs.blocks[block1].on]);
        } else {
            plan.push(['pickup', block1]);
        }

        // Put down block1 on block2
        plan.push(['putdown', block1, block2]);

        return plan;
    }
}

// Export both the class and the generatePlan function
function generatePlan(beliefs, parsedGoal) {
    if (parsedGoal.length !== 2) {
        console.log("❌ Invalid goal format. Expected: 'block1 on block2'");
        return [];
    }
    
    const [block1, block2] = parsedGoal;
    const planner = new PlanLibrary();
    return planner.createPlan(beliefs, block1, block2);
}

module.exports = PlanLibrary;
module.exports.generatePlan = generatePlan;
