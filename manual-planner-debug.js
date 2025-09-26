// Developer regression harness for the BDI planner.
// Invoked via `node planner-debug.js` or `npm run test:planner`.

const { planBlocksWorld } = require('./bdi/blocksWorldAgent');

const PRESET_SCENARIOS = [
  {
    label: 'reverse single stack',
    stacks: [['A', 'B', 'C', 'D']],
    goal: ['D', 'C', 'B', 'A']
  },
  {
    label: 'build tower',
    stacks: [['D'], ['C'], ['B'], ['A']],
    goal: ['A', 'B', 'C', 'D']
  },
  {
    label: 'interleaved restack',
    stacks: [['A', 'D'], ['C', 'B']],
    goal: ['A', 'B', 'C', 'D']
  }
];

function runPlannerRegressionSuite({ scenarios = PRESET_SCENARIOS, maxIterations = 2500, log = false } = {}) {
  const results = scenarios.map(({ label, stacks, goal }) => {
    try {
      const outcome = planBlocksWorld(stacks, goal, { maxIterations });
      if (log) {
        console.log(`✔ ${label}`);
      }
      return {
        label,
        success: true,
        iterations: outcome.iterations,
        moves: outcome.moves
      };
    } catch (error) {
      if (log) {
        console.error(`✖ ${label} :: ${error.message}`);
      }
      return {
        label,
        success: false,
        error: error.message
      };
    }
  });

  return results;
}

if (require.main === module) {
  const results = runPlannerRegressionSuite({ log: true });
  const failed = results.filter(result => !result.success);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  runPlannerRegressionSuite,
  PRESET_SCENARIOS
};
