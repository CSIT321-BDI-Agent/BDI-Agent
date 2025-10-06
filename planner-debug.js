// Developer regression harness for the BDI planner.
// Invoked via `node planner-debug.js` or `npm run test:planner`.

const assert = require('node:assert/strict');
const { planBlocksWorld } = require('./bdi/blocksWorldAgent');

const PRESET_SCENARIOS = [
  {
    label: 'reverse single stack',
    stacks: [['A', 'B', 'C', 'D']],
    goal: ['D', 'C', 'B', 'A'],
    expectations: {
      iterations: 0,
      moves: [],
      finalOnMap: {
        A: 'Table',
        B: 'A',
        C: 'B',
        D: 'C'
      }
    }
  },
  {
    label: 'build tower',
    stacks: [['D'], ['C'], ['B'], ['A']],
    goal: ['A', 'B', 'C', 'D'],
    expectations: {
      iterations: 3,
      moves: [
        { block: 'C', to: 'D' },
        { block: 'B', to: 'C' },
        { block: 'A', to: 'B' }
      ],
      finalOnMap: {
        D: 'Table',
        C: 'D',
        B: 'C',
        A: 'B'
      }
    }
  },
  {
    label: 'interleaved restack',
    stacks: [['A', 'D'], ['C', 'B']],
    goal: ['A', 'B', 'C', 'D'],
    expectations: {
      iterations: 5,
      moves: [
        { block: 'D', to: 'Table' },
        { block: 'B', to: 'Table' },
        { block: 'C', to: 'D' },
        { block: 'B', to: 'C' },
        { block: 'A', to: 'B' }
      ],
      finalOnMap: {
        D: 'Table',
        C: 'D',
        B: 'C',
        A: 'B'
      }
    }
  },
  {
    label: 'explicit table anchoring',
    stacks: [['E'], ['D', 'C', 'B', 'A']],
    goal: ['B', 'C', 'D', 'A', 'Table'],
    expectations: {
      iterations: 6,
      moves: [
        { block: 'A', to: 'Table' },
        { block: 'B', to: 'Table' },
        { block: 'C', to: 'Table' },
        { block: 'D', to: 'A' },
        { block: 'C', to: 'D' },
        { block: 'B', to: 'C' }
      ],
      finalOnMap: {
        E: 'Table',
        A: 'Table',
        D: 'A',
        C: 'D',
        B: 'C'
      }
    }
  },
  {
    label: 'invalid looped goal detected',
    stacks: [['D', 'E', 'C', 'A', 'B']],
    goal: ['A', 'D', 'E', 'C', 'A'],
    expectFailure: true,
    expectedErrorIncludes: 'repeats block "A"'
  },
  {
    label: 'invalid duplicate blocks in stacks',
    stacks: [['A', 'B'], ['C', 'A']],
    goal: ['A', 'B', 'C'],
    expectFailure: true,
    expectedErrorIncludes: 'duplicate'
  },
  {
    label: 'invalid goal references unknown block',
    stacks: [['A'], ['B']],
    goal: ['A', 'B', 'Z'],
    expectFailure: true,
    expectedErrorIncludes: 'unknown'
  },
  {
    label: 'invalid empty goal chain',
    stacks: [['A', 'B']],
    goal: [],
    expectFailure: true,
    expectedErrorIncludes: 'at least two'
  },
  {
    label: 'invalid single element goal',
    stacks: [['A', 'B']],
    goal: ['A'],
    expectFailure: true,
    expectedErrorIncludes: 'at least two'
  },
  {
    label: 'invalid non-array stacks',
    stacks: 'not-an-array',
    goal: ['A', 'B'],
    expectFailure: true,
    expectedErrorIncludes: 'array'
  },
  {
    label: 'invalid table in middle of goal',
    stacks: [['A'], ['B'], ['C']],
    goal: ['A', 'Table', 'B'],
    expectFailure: true,
    expectedErrorIncludes: 'only appear as the final'
  }
];

function validateOutcome(outcome, scenario) {
  const { label, expectations = {} } = scenario;

  assert.equal(
    outcome.goalAchieved,
    true,
    `${label}: planner reported failure despite producing a plan`
  );

  if (typeof expectations.iterations === 'number') {
    assert.equal(
      outcome.iterations,
      expectations.iterations,
      `${label}: expected ${expectations.iterations} iterations, got ${outcome.iterations}`
    );
  }

  if (expectations.movesLength != null) {
    assert.equal(
      outcome.moves.length,
      expectations.movesLength,
      `${label}: expected ${expectations.movesLength} moves, got ${outcome.moves.length}`
    );
  }

  if (Array.isArray(expectations.moves)) {
    assert.equal(
      outcome.moves.length,
      expectations.moves.length,
      `${label}: move count mismatch`
    );
    expectations.moves.forEach((expectedMove, idx) => {
      const actual = outcome.moves[idx];
      assert.ok(actual, `${label}: missing move at index ${idx}`);
      if (expectedMove.block) {
        assert.equal(
          actual.block,
          expectedMove.block,
          `${label}: move ${idx + 1} expected block ${expectedMove.block}, got ${actual.block}`
        );
      }
      if (expectedMove.to) {
        assert.equal(
          actual.to,
          expectedMove.to,
          `${label}: move ${idx + 1} expected destination ${expectedMove.to}, got ${actual.to}`
        );
      }
    });
  }

  if (expectations.finalOnMap) {
    assert.deepEqual(
      outcome.beliefs?.onMap,
      expectations.finalOnMap,
      `${label}: final on-map configuration mismatch`
    );
  }
}

function runPlannerRegressionSuite({ scenarios = PRESET_SCENARIOS, maxIterations = 2500, log = false } = {}) {
  const results = scenarios.map((scenario) => {
    const {
      label,
      stacks,
      goal,
      expectFailure,
      expectedErrorIncludes
    } = scenario;

    try {
      const outcome = planBlocksWorld(stacks, goal, { maxIterations });

      if (expectFailure) {
        const message = 'Expected failure, but planner succeeded';
        if (log) {
          console.error(`✖ ${label} :: ${message}`);
        }
        return {
          label,
          success: false,
          error: message
        };
      }

      try {
        validateOutcome(outcome, scenario);
      } catch (assertionError) {
        if (log) {
          console.error(`✖ ${label} :: ${assertionError.message}`);
        }
        return {
          label,
          success: false,
          error: assertionError.message
        };
      }

      if (log) {
        console.log(`✔ ${label}`);
      }
      return {
        label,
        success: true,
        iterations: outcome.iterations,
        moves: outcome.moves,
        beliefs: outcome.beliefs
      };
    } catch (error) {
      if (!expectFailure) {
        if (log) {
          console.error(`✖ ${label} :: ${error.message}`);
        }
        return {
          label,
          success: false,
          error: error.message
        };
      }

      const matchesExpectation = !expectedErrorIncludes
        || String(error.message).toLowerCase().includes(expectedErrorIncludes.toLowerCase());

      if (log) {
        const status = matchesExpectation ? '✔' : '✖';
        const detail = matchesExpectation ? 'expected failure' : `wrong error: ${error.message}`;
        console.log(`${status} ${label} (${detail})`);
      }

      return {
        label,
        success: matchesExpectation,
        error: matchesExpectation ? null : error.message
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
