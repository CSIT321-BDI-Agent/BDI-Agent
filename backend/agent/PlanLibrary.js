// PlanLibrary.js
function generatePlan(beliefs, block1, block2) {
  const plan = [];

  // Prevent invalid goals
  if (block1 === block2) return plan;
  if (!beliefs.blocks[block1] || !beliefs.blocks[block2]) return plan;

  const holding = beliefs.holding;
  const block1Location = beliefs.blocks[block1];
  const block2Location = beliefs.blocks[block2];

  // Goal already satisfied
  if (block1Location === block2) return plan;

  // Step 0: If not holding block1, pick it up (must be clear)
  if (!holding) {
    const topOfBlock1 = Object.keys(beliefs.blocks).find(
      k => beliefs.blocks[k] === block1
    );
    if (topOfBlock1) return plan; // block1 isn't clear
    plan.push(["pickup", block1]);
  } else if (holding !== block1) {
    return plan; // holding the wrong block
  }

  // Step 1: Make sure block2 is clear
  const topOfBlock2 = Object.keys(beliefs.blocks).find(
    k => beliefs.blocks[k] === block2
  );
  if (topOfBlock2) return plan; // block2 is not clear

  // Step 2: Stack
  plan.push(["putdown", block1, block2]);
  return plan;
}

module.exports = { generatePlan };
