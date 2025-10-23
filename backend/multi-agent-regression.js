#!/usr/bin/env node

/**
 * Unified multi-agent regression suite.
 *
 * Usage:
 *   node multi-agent-regression.js           # Run planner scenarios
 *   node multi-agent-regression.js --api     # Run planner scenarios + API endpoint checks
 */

const http = require('http');
const { trueBDIPlan } = require('./bdi/multiAgentEnvironment');

const plannerScenarios = [
  {
    name: 'Simple 2-block',
    stacks: [['A', 'B']],
    goalChain: ['A', 'B', 'Table']
  },
  {
    name: 'Reverse stack',
    stacks: [['A', 'B'], ['C']],
    goalChain: ['B', 'A', 'C', 'Table']
  },
  {
    name: 'Complex reorder (former deadlock)',
    stacks: [['A'], ['B', 'C'], ['D']],
    goalChain: ['D', 'C', 'B', 'A', 'Table']
  },
  {
    name: '5-block chain',
    stacks: [['E', 'D'], ['C'], ['B'], ['A']],
    goalChain: ['E', 'D', 'C', 'B', 'A', 'Table']
  },
  {
    name: 'Interleaved restack',
    stacks: [['C', 'B', 'A'], ['F', 'E', 'D']],
    goalChain: ['A', 'D', 'B', 'E', 'C', 'F', 'Table']
  },
  {
    name: 'Frontend stress scenario',
    stacks: [['E'], ['I'], ['G', 'F', 'D', 'B', 'A', 'C'], ['H']],
    goalChain: ['A', 'B', 'C', 'D', 'E', 'F', 'Table']
  },
  {
    name: 'Independent towers (parallel)',
    stacks: [['C'], ['B'], ['A'], ['D']],
    goalChain: [
      ['C', 'B', 'Table'],
      ['A', 'D', 'Table']
    ],
    expect: {
      planningApproach: 'multi-tower-independent',
      agentCount: 2,
      minParallelExecutions: 1,
      requireConcurrentCycle: true,
      minMoveCycles: 1
    }
  },
  {
    name: 'Independent towers (dependency fallback)',
    stacks: [['C', 'D'], ['A', 'B']],
    goalChain: [
      ['A', 'B', 'Table'],
      ['C', 'D', 'Table']
    ],
    expect: {
      planningApproach: 'true-multi-agent-bdi',
      agentCount: 2,
      maxParallelExecutions: 0,
      minMoveCycles: 4
    }
  },
  {
    name: 'Three tower split (unsupported)',
    stacks: [['C'], ['B'], ['A']],
    goalChain: [
      ['A', 'Table'],
      ['B', 'Table'],
      ['C', 'Table']
    ],
    expectFailure: {
      status: 400,
      messageIncludes: 'supports up to two towers'
    }
  }
];

const apiScenarios = [
  {
    name: 'Complex reorder (API)',
    stacks: [['A'], ['B', 'C'], ['D']],
    goalChain: ['D', 'C', 'B', 'A', 'Table']
  },
  {
    name: 'Simple 3-block (API)',
    stacks: [['A', 'B'], ['C']],
    goalChain: ['A', 'B', 'C', 'Table']
  },
  {
    name: 'Frontend stress (API)',
    stacks: [['E'], ['I'], ['G', 'F', 'D', 'B', 'A', 'C'], ['H']],
    goalChain: ['A', 'B', 'C', 'D', 'E', 'F', 'Table']
  }
];

function formatStacks(stacks) {
  return JSON.stringify(stacks);
}

function hasConcurrentCycle(moves = []) {
  return moves.some((cycle) => Array.isArray(cycle?.moves) && cycle.moves.filter(Boolean).length > 1);
}

function validateParallelActors(result) {
  const invalidCycles = [];
  (result.moves || []).forEach((cycle) => {
    const actors = (cycle.moves || []).map((move) => move.actor);
    if (actors.length > 1) {
      const invalid = actors.filter((actor) => actor !== 'Agent-A' && actor !== 'Agent-B');
      if (invalid.length > 0) {
        invalidCycles.push({ cycle: cycle.cycle, actors });
      }
    }
  });

  if (invalidCycles.length > 0) {
    const details = invalidCycles
      .map((entry) => `cycle ${entry.cycle} -> [${entry.actors.join(', ')}]`)
      .join('; ');
    throw new Error(`Invalid actor identifiers detected in parallel cycles: ${details}`);
  }
}

async function runPlannerScenario(scenario) {
  const start = Date.now();

  try {
    const result = await trueBDIPlan(scenario.stacks, scenario.goalChain, scenario.options);
    const elapsed = Date.now() - start;

    if (scenario.expectFailure) {
      throw new Error('Scenario succeeded but was expected to fail.');
    }

    validateParallelActors(result);

    const stats = result.statistics || {};
    const agentAMoveCount = typeof stats.agentAMoves === 'number' ? stats.agentAMoves : undefined;
    const agentBMoveCount = typeof stats.agentBMoves === 'number' ? stats.agentBMoves : undefined;
    const totalMoves = Number.isFinite(agentAMoveCount) && Number.isFinite(agentBMoveCount)
      ? agentAMoveCount + agentBMoveCount
      : (result.moves || []).reduce(
          (sum, cycle) => sum + (Array.isArray(cycle?.moves) ? cycle.moves.length : 0),
          0
        );

    if (scenario.expect) {
      const {
        planningApproach,
        agentCount,
        minParallelExecutions,
        maxParallelExecutions,
        requireConcurrentCycle,
        minMoveCycles,
        goalAchieved
      } = scenario.expect;

      const errors = [];
      if (planningApproach && result.planningApproach !== planningApproach) {
        errors.push(`planningApproach expected ${planningApproach}, got ${result.planningApproach}`);
      }
      if (Number.isFinite(agentCount) && result.agentCount !== agentCount) {
        errors.push(`agentCount expected ${agentCount}, got ${result.agentCount}`);
      }
      if (Number.isFinite(minParallelExecutions) && (stats.totalParallelExecutions ?? 0) < minParallelExecutions) {
        errors.push(`totalParallelExecutions expected >= ${minParallelExecutions}, got ${stats.totalParallelExecutions ?? 0}`);
      }
      if (Number.isFinite(maxParallelExecutions) && (stats.totalParallelExecutions ?? 0) > maxParallelExecutions) {
        errors.push(`totalParallelExecutions expected <= ${maxParallelExecutions}, got ${stats.totalParallelExecutions ?? 0}`);
      }
      if (requireConcurrentCycle && !hasConcurrentCycle(result.moves || [])) {
        errors.push('expected at least one concurrent move cycle');
      }
      if (Number.isFinite(minMoveCycles) && (result.moves?.length ?? 0) < minMoveCycles) {
        errors.push(`move cycles expected >= ${minMoveCycles}, got ${result.moves?.length ?? 0}`);
      }
      if (typeof goalAchieved === 'boolean' && result.goalAchieved !== goalAchieved) {
        errors.push(`goalAchieved expected ${goalAchieved}, got ${result.goalAchieved}`);
      }

      if (errors.length > 0) {
        throw new Error(`Expectation failure: ${errors.join('; ')}`);
      }
    }

    console.log(`\u2714 ${scenario.name}`);
    console.log(`  Iterations: ${result.iterations}`);
    console.log(`  Moves: ${totalMoves} (Agent-A: ${agentAMoveCount ?? 'n/a'}, Agent-B: ${agentBMoveCount ?? 'n/a'})`);
    console.log(`  Conflicts: ${stats.totalConflicts ?? 'n/a'}, Negotiations: ${stats.totalNegotiations ?? 'n/a'}`);
    console.log(`  Parallel cycles: ${stats.totalParallelExecutions ?? 'n/a'}`);
    console.log(`  Planning approach: ${result.planningApproach}`);
    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Goal achieved: ${result.goalAchieved}`);
    console.log(`  Stacks: ${formatStacks(scenario.stacks)}`);
    console.log(`  Goal: ${Array.isArray(scenario.goalChain) ? JSON.stringify(scenario.goalChain) : scenario.goalChain}`);
    console.log();

    return { success: true, elapsed, result };
  } catch (error) {
    if (scenario.expectFailure) {
      const { status, messageIncludes } = scenario.expectFailure;
      const statusMatches = !Number.isFinite(status) || error.status === status;
      const messageMatches = !messageIncludes || (typeof error.message === 'string' && error.message.includes(messageIncludes));

      if (statusMatches && messageMatches) {
        const elapsed = Date.now() - start;
        console.log(`\u2714 ${scenario.name} (expected failure)`);
        console.log(`  Status: ${error.status ?? 'n/a'}`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Time: ${elapsed}ms`);
        console.log();
        return { success: true, expectedFailure: true, elapsed, error };
      }

      throw new Error(`Unexpected failure outcome: ${error.message}`);
    }

    throw error;
  }
}


async function runPlannerSuite() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   MULTI-AGENT TRUE BDI PLANNER REGRESSION    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const summary = [];

  for (const scenario of plannerScenarios) {
    try {
      summary.push({ scenario, ...(await runPlannerScenario(scenario)) });
    } catch (error) {
      console.error(`✗ ${scenario.name}`);
      console.error(`  Error: ${error.message}`);
      summary.push({ scenario, success: false, error });
      console.error();
    }
  }

  const passed = summary.filter((entry) => entry.success).length;
  const failed = summary.length - passed;

  console.log('Planner summary:');
  console.log(`  Scenarios: ${summary.length}`);
  console.log(`  Passed:    ${passed}`);
  console.log(`  Failed:    ${failed}\n`);

  return { passed, failed, summary };
}

function login() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ username: 'admin', password: 'admin123' });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.token) {
            resolve(body.token);
          } else {
            reject(new Error('JWT token missing from login response'));
          }
        } catch (err) {
          reject(new Error(`Failed to parse login response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function callPlanningEndpoint(testCase, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ stacks: testCase.stacks, goalChain: testCase.goalChain });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/multi-agent-plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (err) {
          reject(new Error(`Failed to parse planning response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function runApiScenario(testCase, token) {
  const start = Date.now();
  const { statusCode, body } = await callPlanningEndpoint(testCase, token);
  const elapsed = Date.now() - start;

  if (statusCode !== 200) {
    throw new Error(`Unexpected status ${statusCode}: ${body?.error || 'unknown error'}`);
  }

  const result = body.result || body;
  validateParallelActors(result);

  console.log(`✓ ${testCase.name}`);
  console.log(`  Status: ${statusCode}`);
  console.log(`  Goal achieved: ${result.goalAchieved}`);
  console.log(`  Iterations: ${result.iterations}`);
  console.log(`  Planning approach: ${result.planningApproach}`);
  if (result.statistics) {
    console.log(`  Agent-A moves: ${result.statistics.agentAMoves}`);
    console.log(`  Agent-B moves: ${result.statistics.agentBMoves}`);
    console.log(`  Conflicts: ${result.statistics.totalConflicts}`);
    console.log(`  Negotiations: ${result.statistics.totalNegotiations}`);
  }
  console.log(`  Response time: ${elapsed}ms\n`);

  return { success: true, elapsed, result };
}

async function runApiSuite() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   /multi-agent-plan API ENDPOINT CHECKS      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  let token;
  try {
    console.log('Logging in as admin...');
    token = await login();
    console.log('✓ Authentication successful\n');
  } catch (error) {
    throw new Error(`Unable to authenticate: ${error.message}`);
  }

  const summary = [];

  for (const scenario of apiScenarios) {
    try {
      summary.push({ scenario, ...(await runApiScenario(scenario, token)) });
    } catch (error) {
      console.error(`✗ ${scenario.name}`);
      console.error(`  Error: ${error.message}`);
      summary.push({ scenario, success: false, error });
      console.error();
    }
  }

  const passed = summary.filter((entry) => entry.success).length;
  const failed = summary.length - passed;

  console.log('API summary:');
  console.log(`  Scenarios: ${summary.length}`);
  console.log(`  Passed:    ${passed}`);
  console.log(`  Failed:    ${failed}\n`);

  return { passed, failed, summary };
}

function parseFlags() {
  const args = new Set(process.argv.slice(2));
  return {
    includeApi: args.has('--api') || args.has('--with-api'),
    plannerOnly: args.has('--planner-only'),
  };
}

(async () => {
  const flags = parseFlags();
  const plannerResults = flags.plannerOnly ? { passed: 0, failed: 0, summary: [] } : await runPlannerSuite();

  const failures = [];
  if (!flags.plannerOnly && plannerResults.failed > 0) {
    failures.push(`${plannerResults.failed} planner scenario(s)`);
  }

  let apiResults = null;
  if (flags.includeApi) {
    try {
      apiResults = await runApiSuite();
      if (apiResults.failed > 0) {
        failures.push(`${apiResults.failed} API scenario(s)`);
      }
    } catch (error) {
      failures.push(`API suite error: ${error.message}`);
      console.error(`API suite failed: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.log('\n❌ Multi-agent regression suite detected issues:');
    failures.forEach((failure) => console.log(`  - ${failure}`));
    process.exitCode = 1;
  } else {
    console.log('\n✅ Multi-agent regression suite passed.');
  }
})();
