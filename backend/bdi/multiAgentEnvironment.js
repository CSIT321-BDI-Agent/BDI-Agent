/**
 * Multi-Agent BDI Environment for Blocks World
 * 
 * Creates and manages two equal-standing BDI agents that deliberate
 * before each action cycle.
 */

const { Environment } = require('js-son-agent');
const { decomposeGoals } = require('./utils/goalDecomposer');
const { createAsyncRunner } = require('./utils/asyncRunner');
const DeliberationManager = require('./deliberation/DeliberationManager');

// Import existing agent creation and utilities from blocksWorldAgent
const {
  createPlannerAgent,
  computeStateFacts,
  extractMove,
  expandMoveToClawSteps,
  sanitizePlannerInputs,
  createInitialPlannerState
} = require('./blocksWorldAgent');

// Import block utilities
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

  console.log('Goal decomposition:');
  console.log('  Agent A:', goalChainA.join(' → '));
  console.log('  Agent B:', goalChainB.join(' → '));
  console.log('  Overlap:', overlap);

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
  const agentA = createPlannerAgent(initialStateA);
  agentA.id = 'agent-a'; // Override ID
  agentA._color = '#4FD1C5'; // Store color for visualization

  const agentB = createPlannerAgent(initialStateB);
  agentB.id = 'agent-b'; // Override ID
  agentB._color = '#F46036'; // Store color for visualization

  // Shared environment state
  const sharedState = {
    stacks: deepCloneStacks(normalizedStacks),
    goalChain: fullGoalChain,
    cycle: 0,
    moves: [],
    intentionLog: [],
    conflicts: [],
    negotiations: [],
    deliberations: []
  };

  // Create deliberation manager
  const deliberationManager = new DeliberationManager({
    agents: [agentA, agentB],
    enableNegotiation,
    timeout: deliberationTimeout
  });

  // Multi-agent update state with deliberation
  const updateState = async (allActions, agentIds, currentState) => {
    currentState.cycle = (currentState.cycle || 0) + 1;

    // Extract proposals from both agents
    const proposals = allActions.map((actions, idx) => {
      const move = extractMove(actions);
      return {
        agentId: agentIds[idx],
        move,
        timestamp: Date.now(),
        cycle: currentState.cycle
      };
    }).filter(p => p.move !== null);

    // If no proposals, return unchanged state
    if (proposals.length === 0) {
      return {
        ...currentState,
        goalAchieved: goalAchieved(currentState.stacks, currentState.goalChain)
      };
    }

    // DELIBERATION PHASE
    const deliberationResult = await deliberationManager.deliberate(
      proposals,
      currentState
    );

    // Store deliberation result
    currentState.deliberations.push(deliberationResult);
    if (deliberationResult.conflicts) {
      currentState.conflicts.push(...deliberationResult.conflicts);
    }
    if (deliberationResult.negotiations) {
      currentState.negotiations.push(...deliberationResult.negotiations);
    }

    // Apply approved moves
    const nextStacks = deepCloneStacks(currentState.stacks);
    const nextMoves = [...currentState.moves];
    const nextIntentionLog = [...currentState.intentionLog];

    deliberationResult.decisions.forEach(decision => {
      if (decision.status === 'approved' || decision.status === 'approved-alternative') {
        const moveToApply = decision.status === 'approved-alternative' 
          ? decision.move 
          : decision.move;

        applyMove(nextStacks, moveToApply.block, moveToApply.to);

        // Generate claw steps using original function (without agentId param)
        const clawSteps = expandMoveToClawSteps(moveToApply, currentState.stacks);

        const appliedMove = {
          block: moveToApply.block,
          to: moveToApply.to,
          reason: moveToApply.reason,
          actor: decision.agentId,
          clawSteps,
          deliberation: {
            status: decision.status,
            reason: decision.reason,
            negotiationId: decision.negotiationId
          }
        };

        nextMoves.push(appliedMove);

        // Add each claw step as a separate cycle in intention log
        clawSteps.forEach((step, stepIdx) => {
          nextIntentionLog.push({
            cycle: nextIntentionLog.length + 1,
            moves: [{
              actor: decision.agentId,
              step: step.type,
              agent: decision.agentId, // Add agent info to step
              ...step
            }],
            resultingStacks: stepIdx === clawSteps.length - 1 ? deepCloneStacks(nextStacks) : currentState.stacks,
            beliefs: computeStateFacts(nextStacks, currentState.goalChain)
          });
        });
      }
    });

    // Update state facts
    const updatedFacts = computeStateFacts(nextStacks, currentState.goalChain);
    const reachedGoal = goalAchieved(nextStacks, currentState.goalChain);

    return {
      ...currentState,
      stacks: nextStacks,
      moves: nextMoves,
      intentionLog: nextIntentionLog,
      goalAchieved: reachedGoal,
      ...updatedFacts,
      lastDeliberation: deliberationResult
    };
  };

  // State filter for agent belief updates (matches original implementation)
  const stateFilter = state => {
    const facts = computeStateFacts(state.stacks, state.goalChain);

    return {
      stacks: deepCloneStacks(state.stacks),
      goalChain: [...state.goalChain],
      goalAchieved: state.goalAchieved,
      onMap: { ...facts.onMap },
      clearBlocks: [...facts.clearBlocks],
      pendingRelation: facts.pendingRelation
        ? { ...facts.pendingRelation }
        : null
    };
  };

  // Create async runner
  const goalCheckFn = () => {
    return Promise.resolve(sharedState.goalAchieved);
  };

  const runner = createAsyncRunner(maxIterations, goalCheckFn);

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

module.exports = {
  createMultiAgentEnvironment
};
