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
  createInitialPlannerState,
  planBlocksWorld
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
  applyMove,
  deriveOnMap
} = createBlocksHelpers(PlanningError);

/**
 * Check if goal chains have interdependencies in the current state.
 * Returns true if blocks from different goal chains are in the same stack
 * where one blocks another, making independent planning impossible.
 */
function hasTowerDependencies(stacks, goalChains) {
  if (goalChains.length < 2) return false;

  // Extract blocks from each goal chain (excluding 'Table')
  const towerBlocks = goalChains.map(chain => 
    new Set(chain.filter(block => block && block !== 'Table'))
  );

  // Require each tower's base block to rest on the table before allowing independence
  const onMap = deriveOnMap(stacks);
  for (const chain of goalChains) {
    if (!Array.isArray(chain) || chain.length < 2) {
      continue;
    }
    const baseBlock = chain[chain.length - 2];
    if (!baseBlock || baseBlock === 'Table') {
      continue;
    }
    const support = onMap[baseBlock];
    if (support && support !== 'Table') {
      console.log(`[Independent Tower Check] Base block "${baseBlock}" is resting on "${support}", treating towers as dependent.`);
      return true;
    }
  }

  // Check each stack for interdependencies
  for (const stack of stacks) {
    if (stack.length < 2) continue; // Single blocks can't block each other

    // For each position in the stack (except the top)
    for (let i = 0; i < stack.length - 1; i++) {
      const lowerBlock = stack[i];
      const upperBlocks = stack.slice(i + 1); // All blocks above this one

      // Check which tower owns the lower block
      const lowerTowerIndex = towerBlocks.findIndex(set => set.has(lowerBlock));
      if (lowerTowerIndex === -1) continue; // Block not in any goal

      // Check if any upper block belongs to a different tower
      for (const upperBlock of upperBlocks) {
        const upperTowerIndex = towerBlocks.findIndex(set => set.has(upperBlock));
        if (upperTowerIndex === -1) continue; // Block not in any goal

        // If blocks from different towers are stacked, we have a dependency
        if (upperTowerIndex !== lowerTowerIndex) {
          console.log(`[Independent Tower Check] Dependency detected: Block "${upperBlock}" (Tower ${upperTowerIndex + 1}) is above "${lowerBlock}" (Tower ${lowerTowerIndex + 1})`);
          return true;
        }
      }
    }
  }

  return false;
}

function planIndependentTowers(initialStacks, goalChains, options = {}) {
  if (!Array.isArray(goalChains) || goalChains.length === 0) {
    throw new PlanningError('Independent tower planning requires at least one goal chain.', 400);
  }

  if (goalChains.length > 2) {
    throw new PlanningError('Independent tower planning currently supports up to two towers.', 400);
  }

  let normalizedReferenceStacks = null;

  const sanitizedChains = goalChains.map((chain, index) => {
    const { goalChain, normalizedStacks } = sanitizePlannerInputs(initialStacks, chain, options);
    if (!normalizedReferenceStacks) {
      normalizedReferenceStacks = normalizedStacks;
    }
    if (!goalChain || goalChain.length === 0) {
      throw new PlanningError(`Goal chain ${index + 1} is invalid.`, 400);
    }
    return goalChain;
  });

  const agentIds = ['Agent-A', 'Agent-B'];
  const towerPlans = sanitizedChains.map((goalChainForTower, idx) => {
    const response = planBlocksWorld(initialStacks, goalChainForTower, options);
    if (!response.goalAchieved) {
      throw new PlanningError(`Unable to achieve tower goal ${idx + 1} with provided configuration.`, 422);
    }

    const agentId = agentIds[idx] || `Agent-${String.fromCharCode(67 + idx)}`;
    const towerBlocks = goalChainForTower.filter(token => token && token !== 'Table');
    const towerSummary = towerBlocks.length ? towerBlocks.join(', ') : 'Table';
    const towerLabel = `Tower ${idx + 1}: ${towerSummary}`;

    const moves = Array.isArray(response.moves)
      ? response.moves.map(move => ({ ...move, actor: agentId }))
      : [];

    const intentionLog = Array.isArray(response.intentionLog)
      ? response.intentionLog.map((entry, entryIdx) => {
          const movesForEntry = Array.isArray(entry.moves)
            ? entry.moves.map(move => ({ ...move, actor: agentId }))
            : [];
          const clonedEntry = {
            ...entry,
            cycle: entryIdx + 1,
            moves: movesForEntry
          };
          if (entryIdx === 0) {
            clonedEntry.sequenceLabel = towerLabel;
          }
          return clonedEntry;
        })
      : [];

    return {
      agentId,
      towerLabel,
      goalChain: goalChainForTower,
      raw: response,
      moves,
      intentionLog
    };
  });

  const maxMoveLength = Math.max(...towerPlans.map(plan => plan.moves.length));
  const combinedMoves = [];
  let cycleIndex = 1;

  for (let idx = 0; idx < maxMoveLength; idx += 1) {
    const cycleMoves = [];
    towerPlans.forEach(plan => {
      const move = plan.moves[idx];
      if (move) {
        cycleMoves.push({ ...move });
      }
    });

    if (cycleMoves.length === 0) {
      continue;
    }

    combinedMoves.push({
      cycle: cycleIndex,
      moves: cycleMoves
    });
    cycleIndex += 1;
  }

  // Interleave intention logs to show concurrent execution properly
  const combinedIntentionLog = [];
  const maxLogLength = Math.max(...towerPlans.map(plan => plan.intentionLog.length));
  
  for (let logIdx = 0; logIdx < maxLogLength; logIdx += 1) {
    towerPlans.forEach(plan => {
      const entry = plan.intentionLog[logIdx];
      if (entry) {
        combinedIntentionLog.push({
          ...entry,
          cycle: combinedIntentionLog.length + 1
        });
      }
    });
  }

  const finalStacks = towerPlans.reduce((stacksAcc, plan) => {
    const nextStacks = deepCloneStacks(stacksAcc);
    plan.moves.forEach(move => {
      applyMove(nextStacks, move.block, move.to);
    });
    return nextStacks;
  }, deepCloneStacks(normalizedReferenceStacks || initialStacks));

  const parallelExecutions = combinedMoves.filter(entry => Array.isArray(entry.moves) && entry.moves.length > 1).length;

  return {
    moves: combinedMoves,
    iterations: Math.max(...towerPlans.map(plan => plan.raw.iterations || 0)),
    goalAchieved: true,
    intentionLog: combinedIntentionLog,
    finalStacks,
    planningApproach: 'multi-tower-independent',
    agentCount: towerPlans.length,
    relationsResolved: sanitizedChains.reduce((total, chain) => total + Math.max(chain.length - 1, 0), 0),
    goalDecomposition: {
      agentA: towerPlans[0]?.goalChain.join(' -> ') || null,
      agentB: towerPlans[1]?.goalChain.join(' -> ') || null,
      overlap: null
    },
    statistics: {
      agentAMoves: towerPlans[0]?.moves.length || 0,
      agentBMoves: towerPlans[1]?.moves.length || 0,
      totalConflicts: 0,
      totalNegotiations: 0,
      totalDeliberations: 0,
      totalParallelExecutions: parallelExecutions,
      conflictDetails: [],
      negotiationDetails: []
    },
    plannerOptionsUsed: {
      maxIterations: options.maxIterations || 2500
    },
    deliberationHistory: []
  };
}

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

  // Decompose goals between agents with staging information
  const decomposition = decomposeGoals(fullGoalChain);
  const goalChainA = decomposition.goalChainA;
  const goalChainB = decomposition.goalChainB;
  const stageBlueprint = decomposition.stages || {
    foundationChain: goalChainB,
    assemblyChain: goalChainA,
    pivot: Array.isArray(decomposition.overlap?.blocks)
      ? decomposition.overlap.blocks[decomposition.overlap.blocks.length - 1]
      : decomposition.overlap
  };
  const foundationCompleteInitial = goalAchieved(normalizedStacks, stageBlueprint.foundationChain);
  const assemblyCompleteInitial = goalAchieved(normalizedStacks, stageBlueprint.assemblyChain);
  const initialStage = foundationCompleteInitial ? 'assembly' : 'foundation';

  // Create initial state for Agent A
  const initialGoalChainA = initialStage === 'foundation'
    ? stageBlueprint.foundationChain
    : stageBlueprint.assemblyChain;

  const stateResultA = createInitialPlannerState(normalizedStacks, initialGoalChainA);
  const initialStateA = stateResultA.alreadySatisfied 
    ? {
        stacks: normalizedStacks,
        goalChain: [...initialGoalChainA],
        moves: [],
        goalAchieved: true,
        iterations: 0,
        intentionLog: [],
        ...computeStateFacts(normalizedStacks, initialGoalChainA)
      }
    : {
        ...stateResultA.initialState,
        goalChain: [...initialGoalChainA]
      };

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
    iterations: 0,
    staging: {
      currentStage: initialStage,
      foundationChain: [...stageBlueprint.foundationChain],
      assemblyChain: [...stageBlueprint.assemblyChain],
      pivotBlock: stageBlueprint.pivot,
      foundationComplete: foundationCompleteInitial,
      assemblyComplete: assemblyCompleteInitial
    }
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
      deliberations: Array.isArray(currentState.deliberations) ? [...currentState.deliberations] : [],
      staging: currentState.staging
        ? {
            currentStage: currentState.staging.currentStage,
            foundationChain: [...currentState.staging.foundationChain],
            assemblyChain: [...currentState.staging.assemblyChain],
            pivotBlock: currentState.staging.pivotBlock,
            foundationComplete: currentState.staging.foundationComplete,
            assemblyComplete: currentState.staging.assemblyComplete
          }
        : null
    };

    const proposals = pendingProposals.filter(entry => entry.move);

    if (proposals.length === 0) {
      const facts = computeStateFacts(nextState.stacks, nextState.goalChain);
      nextState.onMap = facts.onMap;
      nextState.clearBlocks = facts.clearBlocks;
      nextState.pendingRelation = facts.pendingRelation;
      nextState.goalAchieved = goalAchieved(nextState.stacks, nextState.goalChain);

      if (nextState.staging) {
        const foundationComplete = goalAchieved(nextState.stacks, nextState.staging.foundationChain);
        const assemblyComplete = goalAchieved(nextState.stacks, nextState.staging.assemblyChain);
        let stageLabel = nextState.staging.currentStage;

        if (stageLabel === 'foundation' && foundationComplete) {
          stageLabel = 'assembly';
        }
        if (assemblyComplete && nextState.goalAchieved) {
          stageLabel = 'complete';
        }

        nextState.staging = {
          ...nextState.staging,
          currentStage: stageLabel,
          foundationComplete,
          assemblyComplete
        };
      }

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

    if (nextState.staging) {
      const foundationComplete = goalAchieved(nextState.stacks, nextState.staging.foundationChain);
      const assemblyComplete = goalAchieved(nextState.stacks, nextState.staging.assemblyChain);
      let stageLabel = nextState.staging.currentStage;

      if (stageLabel === 'foundation' && foundationComplete) {
        stageLabel = 'assembly';
      }
      if (assemblyComplete && nextState.goalAchieved) {
        stageLabel = 'complete';
      }

      nextState.staging = {
        ...nextState.staging,
        currentStage: stageLabel,
        foundationComplete,
        assemblyComplete
      };
    }

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
    const staging = state?.staging;
    let agentGoalChain;

    if (agentId === 'agent-a') {
      if (staging?.currentStage === 'foundation') {
        agentGoalChain = staging?.foundationChain || goalChainB;
      } else if (staging?.currentStage === 'complete') {
        agentGoalChain = fullGoalChain;
      } else {
        agentGoalChain = stageBlueprint.assemblyChain || goalChainA;
      }
    } else {
      agentGoalChain = staging?.foundationChain || goalChainB;
    }

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

    if (staging) {
      filtered.staging = {
        currentStage: staging.currentStage,
        foundationComplete: staging.foundationComplete,
        assemblyComplete: staging.assemblyComplete,
        pivotBlock: staging.pivotBlock
      };
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
    goalDecomposition: {
      goalChainA,
      goalChainB,
      overlap: decomposition.overlap,
      stages: stageBlueprint
    }
  };
}
/**
 * Runs the true multi-agent BDI planner and formats the planning report.
 */
async function trueBDIPlan(initialStacks, goalPayload, options = {}) {
  const {
    maxIterations = 2500,
    deliberationTimeout = 5000,
    enableNegotiation = true
  } = options;

  const isNestedGoal = Array.isArray(goalPayload) && goalPayload.length > 0 && Array.isArray(goalPayload[0]);

  if (isNestedGoal) {
    if (goalPayload.length > 1) {
      // Check if towers have dependencies that prevent independent planning
      const hasDependencies = hasTowerDependencies(initialStacks, goalPayload);
      
      if (hasDependencies) {
        console.log('[Multi-Agent] Towers have dependencies, using negotiation-based planning');
        // Flatten goal chains for negotiation-based planning
        const flattenedGoal = goalPayload.flat().filter(block => block && block !== 'Table');
        flattenedGoal.push('Table');
        goalPayload = flattenedGoal;
      } else {
        console.log('[Multi-Agent] No dependencies detected, using independent tower planning');
        return planIndependentTowers(initialStacks, goalPayload, options);
      }
    } else {
      goalPayload = goalPayload[0];
    }
  }

  const goalChain = goalPayload;

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

