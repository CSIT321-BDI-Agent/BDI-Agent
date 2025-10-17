/**
 * Multi-Agent BDI planner using js-son Environment orchestration.
 *
 * Two autonomous agents pursue complementary goal chains, deliberate on
 * conflicts, and execute moves while the js-son Environment keeps beliefs
 * in sync. Deliberation remains external (async) so we can negotiate before
 * each cycle completes.
 */

const { Environment } = require('js-son-agent');
const { decomposeGoals } = require('./utils/goalDecomposer');
const DeliberationManager = require('./deliberation/DeliberationManager');
const {
  createPlannerAgent,
  computeStateFacts,
  extractMove,
  expandMoveToClawSteps,
  sanitizePlannerInputs,
  createInitialPlannerState
} = require('./blocksWorldAgent');
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
 * Main entry point: Create multi-agent environment
 * 
 * @param {Array} initialStacks - Starting block configuration
 * @param {Array} goalChain - Goal configuration
 * @param {Object} options - Configuration options
 * @returns {Object} Environment and manager instances
 */
function createMultiAgentEnvironment(initialStacks, goalChain, options = {}) {
  const {
    maxIterations = 1000,
    deliberationTimeout = 5000,
    enableNegotiation = true
  } = options;

  // Use existing sanitization and validation
  const { normalizedStacks, goalChain: fullGoalChain } = sanitizePlannerInputs(
    initialStacks,
    goalChain,
    options
  );

  // Decompose goals between agents
  const { goalChainA, goalChainB, overlap } = decomposeGoals(fullGoalChain);

  // Create initial state for Agent A
  const stateResultA = createInitialPlannerState(normalizedStacks, goalChainA);
  const initialStateA = stateResultA.alreadySatisfied 
    ? {
        stacks: normalizedStacks,
        goalChain: goalChainA,
        moves: [],
        goalAchieved: true,
        iterations: 0,
        intentionLog: [],
        ...computeStateFacts(normalizedStacks, goalChainA)
      }
    : stateResultA.initialState;

  // Create initial state for Agent B  
  const stateResultB = createInitialPlannerState(normalizedStacks, goalChainB);
  const initialStateB = stateResultB.alreadySatisfied
    ? {
        stacks: normalizedStacks,
        goalChain: goalChainB,
        moves: [],
        goalAchieved: true,
        iterations: 0,
        intentionLog: [],
        ...computeStateFacts(normalizedStacks, goalChainB)
      }
    : stateResultB.initialState;

  // Create two agents using existing agent creator
  const agentA = createPlannerAgent(initialStateA, 'agent-a');
  agentA._color = '#4FD1C5'; // Store color for visualization

  const agentB = createPlannerAgent(initialStateB, 'agent-b');
  agentB._color = '#F46036'; // Store color for visualization

  const globalFacts = computeStateFacts(normalizedStacks, fullGoalChain);

  const sharedState = {
    stacks: deepCloneStacks(normalizedStacks),
    goalChain: fullGoalChain,
    cycle: 0,
    moves: [],
    intentionLog: [],
    conflicts: [],
    negotiations: [],
    deliberations: [],
  pendingProposals: [],
    onMap: globalFacts.onMap,
    clearBlocks: globalFacts.clearBlocks,
    pendingRelation: globalFacts.pendingRelation,
    goalAchieved: goalAchieved(normalizedStacks, fullGoalChain),
    iterations: 0
  };

  // Create deliberation manager
  const deliberationManager = new DeliberationManager({
    agents: [agentA, agentB],
    enableNegotiation,
    timeout: deliberationTimeout
  });

  const agentCount = deliberationManager.agents.length || 0;

  const updateState = (actions, actorId, currentState) => {
    const agentId = Array.isArray(actorId) ? actorId[0] : actorId;
    const filteredBuffer = Array.isArray(currentState.pendingProposals)
      ? currentState.pendingProposals.filter(entry => entry && entry.agentId !== agentId)
      : [];

    const proposalEntry = {
      agentId,
      move: extractMove(actions),
      timestamp: Date.now(),
      deliberationCycle: (currentState.cycle || 0) + 1
    };

    const pendingProposals = [...filteredBuffer, proposalEntry];
    const requiredProposals = Math.max(agentCount, 1);

    if (pendingProposals.length < requiredProposals) {
      return {
        ...currentState,
        pendingProposals
      };
    }

    const nextCycle = (currentState.cycle || 0) + 1;

    const nextState = {
      ...currentState,
      cycle: nextCycle,
      iterations: nextCycle,
      pendingProposals: [],
      stacks: deepCloneStacks(currentState.stacks),
      moves: Array.isArray(currentState.moves) ? [...currentState.moves] : [],
      intentionLog: Array.isArray(currentState.intentionLog) ? [...currentState.intentionLog] : [],
      conflicts: Array.isArray(currentState.conflicts) ? [...currentState.conflicts] : [],
      negotiations: Array.isArray(currentState.negotiations) ? [...currentState.negotiations] : [],
      deliberations: Array.isArray(currentState.deliberations) ? [...currentState.deliberations] : []
    };

    const proposals = pendingProposals.filter(entry => entry.move);

    if (proposals.length === 0) {
      const facts = computeStateFacts(nextState.stacks, nextState.goalChain);
      nextState.onMap = facts.onMap;
      nextState.clearBlocks = facts.clearBlocks;
      nextState.pendingRelation = facts.pendingRelation;
      nextState.goalAchieved = goalAchieved(nextState.stacks, nextState.goalChain);

      if (!nextState.goalAchieved) {
        throw new PlanningError('Planner stalled before achieving the goal.', 422);
      }

      nextState.cycle = currentState.cycle || 0;
      nextState.iterations = currentState.iterations || currentState.cycle || 0;

      return nextState;
    }

    const deliberationResult = deliberationManager.deliberate(proposals, nextState);
    const deliberationEntry = {
      ...deliberationResult,
      cycle: nextState.cycle
    };
    nextState.deliberations.push(deliberationEntry);

    if (Array.isArray(deliberationResult.conflicts) && deliberationResult.conflicts.length > 0) {
      nextState.conflicts.push(...deliberationResult.conflicts);
    }
    if (Array.isArray(deliberationResult.negotiations) && deliberationResult.negotiations.length > 0) {
      nextState.negotiations.push(...deliberationResult.negotiations);
    }

    const decisionByAgent = new Map();
    (deliberationResult.decisions || []).forEach(decision => {
      decisionByAgent.set(decision.agentId, decision);
    });

    const appliedActors = new Set();

    (deliberationResult.decisions || []).forEach(decision => {
      if (decision.status !== 'approved' && decision.status !== 'approved-alternative') {
        return;
      }

      const moveToApply = decision.move;
      const stacksBeforeMove = deepCloneStacks(nextState.stacks);
      applyMove(nextState.stacks, moveToApply.block, moveToApply.to);
      const stacksAfterMove = deepCloneStacks(nextState.stacks);

      const clawSteps = expandMoveToClawSteps(moveToApply, stacksBeforeMove);
      appliedActors.add(decision.agentId);

      nextState.moves.push({
        block: moveToApply.block,
        to: moveToApply.to,
        reason: moveToApply.reason,
        actor: decision.agentId,
        clawSteps,
        deliberation: {
          status: decision.status,
          reason: decision.reason,
          negotiationId: decision.negotiationId,
          cycle: nextState.cycle
        }
      });

      const beliefsAfterMove = computeStateFacts(stacksAfterMove, nextState.goalChain);

      clawSteps.forEach((step, idx) => {
        const resultingStacks = idx === clawSteps.length - 1
          ? deepCloneStacks(stacksAfterMove)
          : deepCloneStacks(stacksBeforeMove);

        nextState.intentionLog.push({
          cycle: nextState.intentionLog.length + 1,
          moves: [{
            actor: decision.agentId,
            stepType: step.type,
            stepDescription: step.description,
            stepNumber: idx + 1,
            totalSteps: clawSteps.length,
            block: step.block || moveToApply.block,
            to: step.to || (step.type === 'PICK_UP' ? 'claw' : moveToApply.to)
          }],
          resultingStacks,
          beliefs: {
            pendingRelation: beliefsAfterMove.pendingRelation ? { ...beliefsAfterMove.pendingRelation } : null,
            clearBlocks: [...beliefsAfterMove.clearBlocks],
            onMap: { ...beliefsAfterMove.onMap }
          }
        });
      });
    });

    const finalFacts = computeStateFacts(nextState.stacks, nextState.goalChain);
    nextState.onMap = finalFacts.onMap;
    nextState.clearBlocks = finalFacts.clearBlocks;
    nextState.pendingRelation = finalFacts.pendingRelation;
    nextState.goalAchieved = goalAchieved(nextState.stacks, nextState.goalChain);

    proposals.forEach(proposal => {
      if (appliedActors.has(proposal.agentId)) {
        return;
      }

      const decision = decisionByAgent.get(proposal.agentId);
      const skippedReason = decision?.reason || (!proposal.move ? 'no-proposal' : 'blocked');

      nextState.intentionLog.push({
        cycle: nextState.intentionLog.length + 1,
        moves: [{
          actor: proposal.agentId,
          skipped: true,
          reason: skippedReason
        }],
        resultingStacks: deepCloneStacks(nextState.stacks),
        beliefs: {
          pendingRelation: finalFacts.pendingRelation ? { ...finalFacts.pendingRelation } : null,
          clearBlocks: [...finalFacts.clearBlocks],
          onMap: { ...finalFacts.onMap }
        }
      });
    });

    if (appliedActors.size === 0 && !nextState.goalAchieved) {
      throw new PlanningError('Planner stalled before achieving the goal.', 422);
    }

    return nextState;
  };

  const stateFilter = (state, agentId, agentBeliefs) => {
    const agentGoalChain = agentId === 'agent-a' ? goalChainA : goalChainB;
    const facts = computeStateFacts(state.stacks, agentGoalChain);

    const filtered = {
      stacks: deepCloneStacks(state.stacks),
      goalChain: [...agentGoalChain],
      goalAchieved: goalAchieved(state.stacks, agentGoalChain),
      onMap: { ...facts.onMap },
      clearBlocks: [...facts.clearBlocks]
    };

    if (facts.pendingRelation) {
      filtered.pendingRelation = { ...facts.pendingRelation };
    } else if (agentBeliefs && Object.prototype.hasOwnProperty.call(agentBeliefs, 'pendingRelation')) {
      delete agentBeliefs.pendingRelation;
    }

    return filtered;
  };

  const runner = step => (iterations = maxIterations) => {
    let executed = 0;
    while (executed < iterations && !sharedState.goalAchieved) {
      step();
      executed += 1;
    }
    return {
      totalIterations: executed,
      terminated: executed >= iterations,
      goalAchieved: sharedState.goalAchieved
    };
  };

  // Create js-son-agent environment
  const environment = new Environment(
    [agentA, agentB],
    sharedState,
    updateState,
    () => {}, // goal generator not used
    stateFilter,
    runner
  );

  return {
    environment,
    deliberationManager,
    agents: { agentA, agentB },
    goalDecomposition: { goalChainA, goalChainB, overlap }
  };
}
/**
 * Runs the true multi-agent BDI planner and formats the planning report.
 */
async function trueBDIPlan(initialStacks, goalChain, options = {}) {
  const {
    maxIterations = 2500,
    deliberationTimeout = 5000,
    enableNegotiation = true
  } = options;

  const { environment, goalDecomposition } = createMultiAgentEnvironment(
    initialStacks,
    goalChain,
    { maxIterations, deliberationTimeout, enableNegotiation }
  );

  try {
    await environment.run(maxIterations);
  } catch (error) {
    throw new PlanningError(`Multi-agent planning failed: ${error.message}`, 500);
  }

  const finalState = environment.state;
  const goalAchievedFinal = Boolean(finalState.goalAchieved);

  if (!goalAchievedFinal) {
    throw new PlanningError(`Unable to achieve goal within ${maxIterations} iterations.`, 422);
  }

  const agentAMoves = finalState.moves.filter(move => move.actor === 'agent-a' || move.actor === 'Agent-A').length;
  const agentBMoves = finalState.moves.filter(move => move.actor === 'agent-b' || move.actor === 'Agent-B').length;

  const cycleParticipation = {};
  finalState.moves.forEach((move, index) => {
    const cycle = move.deliberation?.cycle ?? (index + 1);
    if (!cycleParticipation[cycle]) {
      cycleParticipation[cycle] = new Set();
    }
    cycleParticipation[cycle].add(move.actor);
  });
  const totalParallelExecutions = Object.values(cycleParticipation)
    .filter(participants => participants.size > 1)
    .length;

  const movesByCycle = finalState.moves.reduce((acc, move, index) => {
    const cycle = move.deliberation?.cycle ?? (index + 1);
    if (!acc[cycle]) {
      acc[cycle] = {
        cycle,
        moves: [],
        deliberation: move.deliberation || {}
      };
    }
    // Normalize actor casing for frontend compatibility (Agent-A, Agent-B)
    const normalizedActor = move.actor === 'agent-a' ? 'Agent-A' 
                          : move.actor === 'agent-b' ? 'Agent-B'
                          : move.actor;
    acc[cycle].moves.push({
      block: move.block,
      to: move.to,
      reason: move.reason,
      actor: normalizedActor,
      planner: 'true-multi-agent-bdi',
      clawSteps: move.clawSteps || []
    });
    return acc;
  }, {});

  return {
    moves: Object.values(movesByCycle),
    iterations: finalState.cycle || 0,
    goalAchieved: goalAchievedFinal,
    intentionLog: finalState.intentionLog || [],
    finalStacks: finalState.stacks,
    planningApproach: 'true-multi-agent-bdi',
    agentCount: 2,
    goalDecomposition: {
      agentA: goalDecomposition.goalChainA.join(' -> '),
      agentB: goalDecomposition.goalChainB.join(' -> '),
      overlap: goalDecomposition.overlap
    },
    statistics: {
      agentAMoves,
      agentBMoves,
      totalConflicts: finalState.conflicts.length,
      totalNegotiations: finalState.negotiations.length,
      totalDeliberations: finalState.deliberations.length,
      totalParallelExecutions,
      conflictDetails: finalState.conflicts.map(conflict => ({
        type: conflict.type,
        agents: conflict.agents,
        blocks: conflict.blocks
      })),
      negotiationDetails: finalState.negotiations.map(negotiation => ({
        id: negotiation.id,
        outcome: negotiation.outcome,
        winner: negotiation.winner
      }))
    },
    deliberationHistory: finalState.deliberations.map(entry => ({
      cycle: entry.cycle,
      proposals: entry.proposals?.length || 0,
      conflicts: entry.conflicts?.length || 0,
      decisions: entry.decisions?.length || 0
    }))
  };
}

module.exports = {
  createMultiAgentEnvironment,
  trueBDIPlan
};

