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

  // Case 1: Not holding anything
  if (!holding) {
    // Step 1: Pickup block1 (if something is on top of it, this won't work)
    const topOfBlock1 = Object.keys(beliefs.blocks).find(
      k => beliefs.blocks[k] === block1
    );
    if (topOfBlock1) return plan; // Something on top, can't move

    plan.push(["pickup", block1]);
  }

  // Case 2: Holding block1 already (optional safety check)
  else if (holding !== block1) {
    return plan; // holding wrong block
  }

  // Step 2: Ensure block2 has no block on top
  const topOfBlock2 = Object.keys(beliefs.blocks).find(
    k => beliefs.blocks[k] === block2
  );
  if (topOfBlock2) return plan; // Can't stack onto a covered block

  // Step 3: Put block1 on block2
  plan.push(["putdown", block1, block2]);

  return plan;
}

module.exports = { generatePlan };
