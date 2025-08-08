// PlanLibrary.js
// The below function build a plan for stacking a block on to another 
function generatePlan(beliefs, block1, block2) {
  const plan = [];

  // Here it prevents the stacking of a block on itself or stacking to unknown blocks
  if (block1 === block2) return plan;
  if (!beliefs.blocks[block1] || !beliefs.blocks[block2]) return plan;

  // Below it gets the current status from the beliefs
  const holding = beliefs.holding;
  const block1Location = beliefs.blocks[block1];
  const block2Location = beliefs.blocks[block2];

  // This is so that when a block is already stacked on a block nothing needs to be done
  if (block1Location === block2) return plan;

  // Idf not holding anything, it will try to pick up the first block selected
  if (!holding) {
    // check to see if block has somethin gon top of it
    const topOfBlock1 = Object.keys(beliefs.blocks).find(
      k => beliefs.blocks[k] === block1
    );
    // seesd that block insnt clear thus does not pick it up
    if (topOfBlock1) return plan; 
    // below is the pickup action 
    plan.push(["pickup", block1]);

    // Below is to not proceed if it is holding something else
  } else if (holding !== block1) {
    return plan; 
  }

  // This is to make sure that the other block is clear before placing the firsty block on it
  const topOfBlock2 = Object.keys(beliefs.blocks).find(
    k => beliefs.blocks[k] === block2
  );
  // block2 is not clear
  if (topOfBlock2) return plan; 

  // This is the step that stacks the blocks
  plan.push(["putdown", block1, block2]);
  return plan;
}

//exports fucntion to be used by the bdi agent
module.exports = { generatePlan };
