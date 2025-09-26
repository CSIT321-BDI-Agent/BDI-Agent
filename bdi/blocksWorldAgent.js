const {
  Agent,
  Belief,
  Desire,
  Plan,
  Environment
} = require('js-son-agent');

const createBlocksHelpers = require('./utils/blocks');

class PlanningError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PlanningError';
    this.status = status;
  }
}

const MAX_DEFAULT_ITERATIONS = 500;

function deepCloneStacks(stacks) {
  return stacks.map(stack => [...stack]);
}

function normalizeStacks(rawStacks) {
  if (!Array.isArray(rawStacks)) {
    throw new PlanningError('Stacks payload must be an array of stacks.');
  }

  const seen = new Set();
  const stacks = rawStacks.map((stack, stackIndex) => {
    if (!Array.isArray(stack)) {
      throw new PlanningError(`Stack at index ${stackIndex} must be an array.`);
    }

    return stack.map((block, blockIndex) => {
      if (typeof block !== 'string') {
        throw new PlanningError(`Block at stack ${stackIndex}, position ${blockIndex} must be a string.`);
      }

      const value = block.trim().toUpperCase();
      if (!/^[A-Z]$/.test(value)) {
        throw new PlanningError(`Block "${block}" is invalid. Use single letters A-Z.`);
      }

      if (seen.has(value)) {
        throw new PlanningError(`Duplicate block detected: "${value}".`);
      }

      seen.add(value);
      return value;
    });
  });

  return { stacks, blocks: Array.from(seen) };
}

function sanitizeGoalChain(rawGoalChain, availableBlocks) {
  if (!Array.isArray(rawGoalChain) || rawGoalChain.length < 2) {
    throw new PlanningError('Goal chain must include at least two identifiers (e.g., "A on B").');
  }

  const chain = rawGoalChain.map((token, index) => {
    if (typeof token !== 'string') {
      throw new PlanningError(`Goal token at position ${index} must be a string.`);
    }
    const normalized = token.trim().toUpperCase();
    if (normalized === 'TABLE') {
      return 'Table';
    }
    if (!/^[A-Z]$/.test(normalized)) {
      throw new PlanningError(`Goal token "${token}" is invalid. Use block letters A-Z.`);
    }
    if (!availableBlocks.includes(normalized)) {
      throw new PlanningError(`Goal references unknown block "${normalized}".`);
    }
  }

  const maxIterations = typeof merged.maxIterations === 'number' && merged.maxIterations > 0
    ? Math.min(Math.floor(merged.maxIterations), MAX_DEFAULT_ITERATIONS)
    : MAX_DEFAULT_ITERATIONS;

  const agentCount = typeof merged.agentCount === 'number' && merged.agentCount >= 1
    ? Math.max(1, Math.min(Math.floor(merged.agentCount), MAX_AGENT_COUNT))
    : DEFAULT_AGENT_COUNT;

  const negotiation = typeof merged.negotiation === 'string' && merged.negotiation.trim().length > 0
    ? merged.negotiation.trim()
    : 'prefer-stack';

  return {
    maxIterations,
    agentCount,
    negotiation
  };
}

function createAgentIds(count) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const suffix = String.fromCharCode(97 + (i % 26));
    const tier = Math.floor(i / 26);
    ids.push(tier === 0 ? `agent-${suffix}` : `agent-${suffix}${tier}`);
  }
  return ids;
}

function createPeerAgent({ id, desires, initialBeliefs }) {
  return new Agent({
    id,
    beliefs: {
      ...Belief('stacks', deepCloneStacks(initialBeliefs.stacks)),
      ...Belief('goalChain', [...initialBeliefs.goalChain]),
      ...Belief('goalAchieved', initialBeliefs.goalAchieved)
    },
    desires,
    plans: [
      Plan(
        intentions => intentions.achieveGoal,
        function () {
          const nextRelation = selectNextRelation(this.beliefs.stacks, this.beliefs.goalChain);
          if (!nextRelation) {
            this.beliefs.goalAchieved = true;
            return null;
          }

          const { block, destination } = nextRelation;

          if (!blockExists(this.beliefs.stacks, block)) {
            throw new PlanningError(`Agent beliefs missing block "${block}".`, 500);
          }
          if (destination !== 'Table' && !blockExists(this.beliefs.stacks, destination)) {
            throw new PlanningError(`Agent beliefs missing destination "${destination}".`, 500);
          }

          if (!isBlockClear(this.beliefs.stacks, block)) {
            const blocker = topMostAbove(this.beliefs.stacks, block);
            if (!blocker) {
              return null;
            }
            return [{
              move: {
                block: blocker,
                to: 'Table',
                reason: MOVE_REASONS.CLEAR_BLOCK,
                target: block
              }
            }];
          }

          if (destination !== 'Table' && !isBlockClear(this.beliefs.stacks, destination)) {
            const blocker = topMostAbove(this.beliefs.stacks, destination);
            if (!blocker) {
              return null;
            }
            return [{
              move: {
                block: blocker,
                to: 'Table',
                reason: MOVE_REASONS.CLEAR_TARGET,
                target: destination
              }
            }];
          }

          if (isOn(this.beliefs.stacks, block, destination)) {
            return null;
          }

          return [{
            move: {
              block,
              to: destination,
              reason: MOVE_REASONS.STACK
            }
          }];
        }
      )
    ]
  });
}

function extractMove(actions) {
  if (!Array.isArray(actions)) {
    return null;
  }

  for (const actionGroup of actions) {
    if (!Array.isArray(actionGroup)) continue;
    for (const action of actionGroup) {
      if (action && action.move && typeof action.move.block === 'string') {
        const destination = typeof action.move.to === 'string'
          ? action.move.to.trim().toUpperCase()
          : 'TABLE';
        return {
          block: action.move.block.trim().toUpperCase(),
          to: destination === 'TABLE' ? 'Table' : destination,
          reason: action.move.reason || 'unspecified',
          target: action.move.target || null
        };
      }
    }
  }

  return null;
}

function validateMoveCandidate(move, stacks, cycleData) {
  if (!blockExists(stacks, move.block)) {
    return { ok: false, fatal: true, code: 'BLOCK_NOT_FOUND' };
  }

  if (cycleData.movedBlocks.includes(move.block)) {
    return { ok: false, code: 'BLOCK_ALREADY_MOVED' };
  }

  if (!isBlockClear(stacks, move.block)) {
    return { ok: false, code: 'BLOCK_NOT_CLEAR' };
  }

  if (move.block === move.to) {
    return { ok: false, fatal: true, code: 'BLOCK_EQUALS_DESTINATION' };
  }

  if (move.to === 'Table') {
    return { ok: true };
  }

  if (!blockExists(stacks, move.to)) {
    return { ok: false, fatal: true, code: 'DESTINATION_NOT_FOUND' };
  }

  if (cycleData.targetedDestinations.includes(move.to)) {
    return { ok: false, code: 'DESTINATION_ALREADY_TARGETED' };
  }

  if (!isBlockClear(stacks, move.to)) {
    return { ok: false, code: 'DESTINATION_NOT_CLEAR' };
  }

  return { ok: true };
}

function createEmptyCycle(iterationId) {
  return {
    id: iterationId,
    processed: [],
    movedBlocks: [],
    targetedDestinations: [],
    movesThisCycle: []
  };
}

function planBlocksWorld(rawStacks, rawGoalChain, options = {}) {
  const { maxIterations, agentCount } = resolvePlannerOptions(options);

  const { stacks: normalizedStacks } = normalizeStacks(rawStacks);
  const goalChain = sanitizeGoalChain(rawGoalChain, normalizedStacks.flat());

  ensureGoalFeasible(goalChain, normalizedStacks);

  const initialGoalAchieved = goalAchieved(normalizedStacks, goalChain);
  if (initialGoalAchieved) {
    return {
      moves: [],
      iterations: 0,
      goalAchieved: true,
      relationsResolved: Math.max(goalChain.length - 1, 0),
      agentCount,
      intentionLog: []
    };
  }

  const agentIds = createAgentIds(agentCount);

  const initialState = {
    stacks: deepCloneStacks(normalizedStacks),
    goalChain: [...goalChain],
    moves: [],
    iterations: 0,
    goalAchieved: initialGoalAchieved,
    agentIds,
    cycleData: createEmptyCycle(0),
    intentionLog: []
  };

  const desires = {
    ...Desire('achieveGoal', beliefs => !goalAchieved(beliefs.stacks, beliefs.goalChain))
  };

  const agents = agentIds.map(id => createPeerAgent({
    id,
    desires,
    initialBeliefs: {
      stacks: initialState.stacks,
      goalChain: goalChain,
      goalAchieved: initialGoalAchieved
    }
  }));

  const stateRef = { goalAchieved: initialGoalAchieved };

  const updateState = (actions, actorId, currentState) => {
    const totalAgents = currentState.agentIds.length;
    const cycleBase = currentState.cycleData && currentState.cycleData.id === currentState.iterations
      ? currentState.cycleData
      : createEmptyCycle(currentState.iterations);

    if (cycleBase.processed.includes(actorId)) {
      throw new PlanningError(`Agent "${actorId}" attempted multiple moves in the same cycle.`, 500);
    }

    let nextStacks = deepCloneStacks(currentState.stacks);
    let nextMoves = [...currentState.moves];
    let nextIntentionLog = [...currentState.intentionLog];

    const cycleData = {
      ...cycleBase,
      processed: [...cycleBase.processed]
    };

    const proposedMove = extractMove(actions);
    let appliedMove = null;
    let validationCode = null;

    if (proposedMove) {
      const validation = validateMoveCandidate(proposedMove, nextStacks, cycleData);
      if (!validation.ok) {
        validationCode = validation.code;
        if (validation.fatal) {
          const message = validation.code === 'BLOCK_EQUALS_DESTINATION'
            ? 'Agent proposed moving a block onto itself.'
            : 'Agent produced an invalid move for the current state.';
          throw new PlanningError(`${message} (${validation.code}).`, 422);
        }
      } else {
        applyMove(nextStacks, proposedMove.block, proposedMove.to);
        appliedMove = {
          block: proposedMove.block,
          to: proposedMove.to,
          reason: proposedMove.reason,
          actor: actorId
        };
        nextMoves = [...nextMoves, appliedMove];

        cycleData.movedBlocks = [...cycleData.movedBlocks, proposedMove.block];
        if (proposedMove.to !== 'Table') {
          cycleData.targetedDestinations = [...cycleData.targetedDestinations, proposedMove.to];
        }
      }
    }

    cycleData.movesThisCycle = [
      ...cycleData.movesThisCycle,
      appliedMove
        ? appliedMove
        : {
            actor: actorId,
            skipped: true,
            reason: validationCode || (proposedMove ? 'no-op' : 'no-proposal')
          }
    ];

    cycleData.processed.push(actorId);

    const finalGoalAchieved = goalAchieved(nextStacks, currentState.goalChain);
    stateRef.goalAchieved = finalGoalAchieved;

    let iterations = currentState.iterations;
    let nextCycleData = cycleData;

    if (cycleData.processed.length === totalAgents) {
      const appliedThisCycle = cycleData.movesThisCycle.filter(move => move && move.block);
      if (!appliedThisCycle.length && !finalGoalAchieved) {
        throw new PlanningError('No applicable moves generated by agents this cycle.', 422);
      }

      nextIntentionLog = [
        ...nextIntentionLog,
        {
          cycle: iterations + 1,
          moves: cycleData.movesThisCycle,
          resultingStacks: deepCloneStacks(nextStacks)
        }
      ];

      iterations += 1;
      nextCycleData = createEmptyCycle(iterations);
    }

    return {
      stacks: nextStacks,
      moves: nextMoves,
      goalAchieved: finalGoalAchieved,
      iterations,
      agentIds: currentState.agentIds,
      cycleData: nextCycleData,
      intentionLog: nextIntentionLog
    };
  };

  const stateFilter = state => ({
    stacks: deepCloneStacks(state.stacks),
    goalChain: [...state.goalChain],
    goalAchieved: state.goalAchieved
  });

  const runner = step => iterations => {
    let count = 0;
    while (count < iterations && !stateRef.goalAchieved) {
      step();
      count += 1;
    }
  };

  const environment = new Environment(
    agents,
    initialState,
    updateState,
    () => {},
    stateFilter,
    runner
  );

  environment.run(maxIterations);

  const finalState = environment.state;
  if (!finalState.goalAchieved) {
    throw new PlanningError(`Unable to achieve goal within ${maxIterations} reasoning cycles.`, 422);
  }

  return {
    moves: finalState.moves,
    iterations: finalState.iterations || 0,
    goalAchieved: finalState.goalAchieved,
    relationsResolved: Math.max(goalChain.length - 1, 0),
    agentCount,
    intentionLog: finalState.intentionLog
  };
}

module.exports = {
  planBlocksWorld,
  PlanningError
};
