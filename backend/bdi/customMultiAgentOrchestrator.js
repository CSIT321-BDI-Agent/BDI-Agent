/**
 * Custom Multi-Agent Orchestrator
 * 
 * Coordinates two BDI agents with deliberation each cycle.
 * Bypasses js-son-agent multi-agent Environment to avoid compatibility issues.
 */

const { getSingleAgentProposal, computeStateFacts } = require('./singleAgentProposal');
const { decomposeGoals } = require('./utils/goalDecomposer');
const { sanitizePlannerInputs } = require('./blocksWorldAgent');
const DeliberationManager = require('./deliberation/DeliberationManager');
const { expandMoveToClawSteps } = require('./blocksWorldAgent');

const createBlocksHelpers = require('./utils/blocks');

class PlanningError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PlanningError';
    this.status = status;
  }
}

const {
  deepCloneStacks,
  goalAchieved,
  applyMove
} = createBlocksHelpers(PlanningError);

/**
 * Runs multi-agent BDI planning with deliberation
 * 
 * @param {Array} initialStacks - Starting block configuration
 * @param {Array} goalChain - Goal configuration
 * @param {Object} options - Configuration options
 * @returns {Object} Planning result with deliberations and moves
 */
async function runCustomMultiAgentPlanning(initialStacks, goalChain, options = {}) {
  const {
    maxIterations = 1000,
    deliberationTimeout = 5000,
    enableNegotiation = true
  } = options;

  // Validate and normalize inputs
  const { normalizedStacks, goalChain: fullGoalChain } = sanitizePlannerInputs(
    initialStacks,
    goalChain,
    options
  );

  // Decompose goals between agents
  const { goalChainA, goalChainB, overlap } = decomposeGoals(fullGoalChain);

  console.log('\n=== Multi-Agent Planning Started ===');
  console.log('Goal Decomposition:');
  console.log('  Agent A:', goalChainA.join(' → '));
  console.log('  Agent B:', goalChainB.join(' → '));
  console.log('  Overlap:', overlap);
  console.log('=====================================\n');

  // Initialize shared world state
  let currentStacks = deepCloneStacks(normalizedStacks);
  
  // Initialize tracking
  const moves = [];
  const intentionLog = [];
  const deliberations = [];
  const conflicts = [];
  const negotiations = [];
  
  // Create deliberation manager
  const deliberationManager = new DeliberationManager({
    agents: [{ id: 'agent-a' }, { id: 'agent-b' }],
    enableNegotiation,
    timeout: deliberationTimeout
  });

  // Track agent-specific goal achievement
  let agentAComplete = false;
  let agentBComplete = false;

  // Main deliberation loop
  let cycle = 0;
  const startTime = Date.now();

  while (cycle < maxIterations) {
    cycle++;

    // DEBUG: Log cycle start
    if (cycle % 100 === 0) {
      console.log(`[DEBUG] Cycle ${cycle}/${maxIterations} - Still planning...`);
      console.log(`[DEBUG] Current stacks:`, JSON.stringify(currentStacks));
      console.log(`[DEBUG] Agent A complete: ${agentAComplete}, Agent B complete: ${agentBComplete}`);
    }

    // Check overall goal achievement
    if (goalAchieved(currentStacks, fullGoalChain)) {
      console.log(`✓ Overall goal achieved at cycle ${cycle}`);
      break;
    }

    // Check individual agent completion
    if (!agentAComplete) {
      agentAComplete = goalAchieved(currentStacks, goalChainA);
      if (agentAComplete) {
        console.log(`✓ Agent A completed its goal at cycle ${cycle}`);
        console.log(`[DEBUG] Agent A goal was:`, goalChainA.join(' → '));
        console.log(`[DEBUG] Current stacks:`, JSON.stringify(currentStacks));
      }
    }

    if (!agentBComplete) {
      agentBComplete = goalAchieved(currentStacks, goalChainB);
      if (agentBComplete) {
        console.log(`✓ Agent B completed its goal at cycle ${cycle}`);
        console.log(`[DEBUG] Agent B goal was:`, goalChainB.join(' → '));
        console.log(`[DEBUG] Current stacks:`, JSON.stringify(currentStacks));
      }
    }

    // DEBUG: Check if both agents complete but overall goal not achieved
    if (agentAComplete && agentBComplete && !goalAchieved(currentStacks, fullGoalChain)) {
      console.log(`[DEBUG] ⚠️ ISSUE DETECTED at cycle ${cycle}:`);
      console.log(`[DEBUG]   - Agent A goal complete: ${goalChainA.join(' → ')}`);
      console.log(`[DEBUG]   - Agent B goal complete: ${goalChainB.join(' → ')}`);
      console.log(`[DEBUG]   - Overall goal NOT complete: ${fullGoalChain.join(' → ')}`);
      console.log(`[DEBUG]   - Current stacks:`, JSON.stringify(currentStacks));
      console.log(`[DEBUG] This indicates a goal decomposition issue!`);
    }

    // STEP 1: Get proposals from both agents
    const proposalA = !agentAComplete 
      ? getSingleAgentProposal('agent-a', currentStacks, goalChainA)
      : null;

    const proposalB = !agentBComplete
      ? getSingleAgentProposal('agent-b', currentStacks, goalChainB)
      : null;

    // DEBUG: Log proposals
    if (cycle <= 5 || cycle % 100 === 0) {
      console.log(`[DEBUG] Cycle ${cycle} proposals:`);
      console.log(`[DEBUG]   Agent A:`, proposalA ? `${proposalA.block} → ${proposalA.to} (${proposalA.reason})` : 'none');
      console.log(`[DEBUG]   Agent B:`, proposalB ? `${proposalB.block} → ${proposalB.to} (${proposalB.reason})` : 'none');
    }

    // If no proposals from either agent, we're stuck
    if (!proposalA && !proposalB) {
      console.log(`[DEBUG] ⚠️ No proposals from either agent at cycle ${cycle}`);
      console.log(`[DEBUG] Agent A complete: ${agentAComplete}, Agent B complete: ${agentBComplete}`);
      console.log(`[DEBUG] Overall goal achieved: ${goalAchieved(currentStacks, fullGoalChain)}`);
      console.log(`[DEBUG] Current stacks:`, JSON.stringify(currentStacks));
      console.log(`[DEBUG] Full goal chain:`, fullGoalChain.join(' → '));
      break;
    }

    // Build proposal array for deliberation
    const proposals = [];
    if (proposalA) {
      proposals.push({
        agentId: 'agent-a',
        move: proposalA,
        timestamp: Date.now(),
        cycle
      });
    }
    if (proposalB) {
      proposals.push({
        agentId: 'agent-b',
        move: proposalB,
        timestamp: Date.now(),
        cycle
      });
    }

    // STEP 2: DELIBERATE
    const deliberationResult = await deliberationManager.deliberate(
      proposals,
      {
        stacks: currentStacks,
        goalChain: fullGoalChain,
        cycle
      }
    );

    // Store deliberation
    deliberations.push({
      cycle,
      proposals,
      ...deliberationResult
    });

    // Collect conflicts and negotiations
    if (deliberationResult.conflicts) {
      conflicts.push(...deliberationResult.conflicts);
    }
    if (deliberationResult.negotiations) {
      negotiations.push(...deliberationResult.negotiations);
    }

    // Log deliberation summary
    if (deliberationResult.conflicts.length > 0) {
      console.log(`  Cycle ${cycle}: ${deliberationResult.conflicts.length} conflict(s) detected`);
      deliberationResult.conflicts.forEach(c => {
        console.log(`    - ${c.type}: ${c.description}`);
      });
    }

    // STEP 3: Apply approved moves
    let movesThisCycle = 0;
    
    deliberationResult.decisions.forEach(decision => {
      if (decision.status === 'approved' || decision.status === 'approved-alternative') {
        const moveToApply = decision.status === 'approved-alternative' 
          ? decision.move 
          : decision.move;

        // Apply move to world
        applyMove(currentStacks, moveToApply.block, moveToApply.to);
        movesThisCycle++;

        // Generate claw steps for visualization
        const clawSteps = expandMoveToClawSteps(moveToApply, currentStacks);

        // Record move
        const appliedMove = {
          block: moveToApply.block,
          to: moveToApply.to,
          reason: moveToApply.reason,
          actor: decision.agentId,
          cycle,
          clawSteps,
          deliberation: {
            status: decision.status,
            reason: decision.reason,
            negotiationId: decision.negotiationId
          }
        };

        moves.push(appliedMove);

        console.log(`  Cycle ${cycle}: ${decision.agentId} moves ${moveToApply.block} to ${moveToApply.to} (${decision.status})`);

        // Add each claw step to intention log
        clawSteps.forEach((step, stepIdx) => {
          intentionLog.push({
            cycle: intentionLog.length + 1,
            moves: [{
              actor: decision.agentId,
              step: step.type,
              agent: decision.agentId,
              ...step
            }],
            resultingStacks: stepIdx === clawSteps.length - 1 
              ? deepCloneStacks(currentStacks) 
              : null,
            beliefs: stepIdx === clawSteps.length - 1
              ? computeStateFacts(currentStacks, fullGoalChain)
              : null
          });
        });
      } else {
        console.log(`  Cycle ${cycle}: ${decision.agentId} move ${decision.status} (${decision.reason})`);
      }
    });

    if (movesThisCycle === 0) {
      console.log(`  Cycle ${cycle}: No moves applied (both blocked or deferred)`);
      // DEBUG: Check if we're stuck in a deadlock
      if (cycle > 50) {
        console.log(`[DEBUG] ⚠️ Potential deadlock - no moves for extended period`);
        console.log(`[DEBUG] Proposals exist but being blocked/deferred`);
      }
    }

    // Safety check for infinite loops
    if (cycle >= maxIterations) {
      console.log(`\n[DEBUG] ❌ REACHED MAXIMUM ITERATIONS (${maxIterations})`);
      console.log(`[DEBUG] Final state analysis:`);
      console.log(`[DEBUG]   Current stacks:`, JSON.stringify(currentStacks));
      console.log(`[DEBUG]   Goal chain:`, fullGoalChain.join(' → '));
      console.log(`[DEBUG]   Agent A goal:`, goalChainA.join(' → '));
      console.log(`[DEBUG]   Agent B goal:`, goalChainB.join(' → '));
      console.log(`[DEBUG]   Agent A complete:`, agentAComplete);
      console.log(`[DEBUG]   Agent B complete:`, agentBComplete);
      console.log(`[DEBUG]   Overall goal achieved:`, goalAchieved(currentStacks, fullGoalChain));
      console.log(`[DEBUG]   Total moves made:`, moves.length);
      console.log(`[DEBUG]   Total deliberations:`, deliberations.length);
      console.log(`[DEBUG]   Total conflicts:`, conflicts.length);
      break;
    }
  }

  const elapsedMs = Date.now() - startTime;
  const finalGoalAchieved = goalAchieved(currentStacks, fullGoalChain);

  console.log('\n=== Multi-Agent Planning Complete ===');
  console.log(`Total cycles: ${cycle}`);
  console.log(`Total moves: ${moves.length}`);
  console.log(`Agent A moves: ${moves.filter(m => m.actor === 'agent-a').length}`);
  console.log(`Agent B moves: ${moves.filter(m => m.actor === 'agent-b').length}`);
  console.log(`Total conflicts: ${conflicts.length}`);
  console.log(`Total negotiations: ${negotiations.length}`);
  console.log(`Goal achieved: ${finalGoalAchieved}`);
  console.log(`Time elapsed: ${elapsedMs}ms`);
  
  // DEBUG: Final diagnostic
  if (!finalGoalAchieved) {
    console.log(`\n[DEBUG] ❌ GOAL NOT ACHIEVED - DIAGNOSTIC:`);
    console.log(`[DEBUG] Final stacks:`, JSON.stringify(currentStacks));
    console.log(`[DEBUG] Expected goal:`, fullGoalChain.join(' → '));
    console.log(`[DEBUG] Goal decomposition:`);
    console.log(`[DEBUG]   Agent A:`, goalChainA.join(' → '), agentAComplete ? '✓' : '✗');
    console.log(`[DEBUG]   Agent B:`, goalChainB.join(' → '), agentBComplete ? '✓' : '✗');
    console.log(`[DEBUG]   Overlap:`, overlap);
    
    // Check each goal relation
    console.log(`[DEBUG] Goal relation check:`);
    for (let i = 0; i < fullGoalChain.length - 1; i++) {
      const block = fullGoalChain[i];
      const expectedBelow = fullGoalChain[i + 1];
      console.log(`[DEBUG]   ${block} should be on ${expectedBelow}: ${checkRelation(currentStacks, block, expectedBelow) ? '✓' : '✗'}`);
    }
  }
  
  console.log('======================================\n');

  // Helper function to check if a block is on another
  function checkRelation(stacks, block, below) {
    for (const stack of stacks) {
      const idx = stack.indexOf(block);
      if (idx > 0 && stack[idx - 1] === below) {
        return true;
      }
      if (idx === 0 && below === 'Table') {
        return true;
      }
    }
    return false;
  }

  return {
    moves,
    iterations: cycle,
    goalAchieved: finalGoalAchieved,
    intentionLog,
    deliberations,
    conflicts,
    negotiations,
    goalDecomposition: {
      goalChainA,
      goalChainB,
      overlap
    },
    statistics: {
      totalCycles: cycle,
      totalMoves: moves.length,
      agentAMoves: moves.filter(m => m.actor === 'agent-a').length,
      agentBMoves: moves.filter(m => m.actor === 'agent-b').length,
      totalConflicts: conflicts.length,
      totalNegotiations: negotiations.length,
      totalDeliberations: deliberations.length,
      elapsedMs,
      ...deliberationManager.getStatistics()
    }
  };
}

module.exports = {
  runCustomMultiAgentPlanning
};
