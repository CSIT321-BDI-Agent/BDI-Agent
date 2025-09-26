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

const {
  deepCloneStacks,
  normalizeStacks,
  sanitizeGoalChain,
  blockExists,
  topMostAbove,
  isBlockClear,
  isOn,
  selectNextRelation,
  goalAchieved,
  applyMove,
  ensureGoalFeasible
} = createBlocksHelpers(PlanningError);

const MOVE_REASONS = {
  CLEAR_BLOCK: 'clear-block',
  CLEAR_TARGET: 'clear-target',
  STACK: 'stack'
};

const AGENT_ID = 'builder-agent';
const MAX_ITERATIONS_CAP = 5000;
const DEFAULT_MAX_ITERATIONS = 2500;

function resolvePlannerOptions(options = {}) {
  const maxIterations = Number.isFinite(options.maxIterations)
    ? Math.max(1, Math.min(Math.floor(options.maxIterations), MAX_ITERATIONS_CAP))
    : DEFAULT_MAX_ITERATIONS;

  return { maxIterations };
}

function createPlannerAgent(initialBeliefs) {
  const plannerDesires = {
    ...Desire('achieveGoal', beliefs => !goalAchieved(beliefs.stacks, beliefs.goalChain))
  };

  return new Agent({
    id: AGENT_ID,
    beliefs: {
      ...Belief('stacks', deepCloneStacks(initialBeliefs.stacks)),
      ...Belief('goalChain', [...initialBeliefs.goalChain]),
      ...Belief('goalAchieved', initialBeliefs.goalAchieved)
    },
    desires: plannerDesires,
    plans: [
      Plan(
        intentions => intentions.achieveGoal,
        function planAchieveGoal() {
          const nextRelation = selectNextRelation(this.beliefs.stacks, this.beliefs.goalChain);

          if (!nextRelation) {
            this.beliefs.goalAchieved = true;
            return null;
          }

          const { block, destination } = nextRelation;

          if (!blockExists(this.beliefs.stacks, block)) {
            throw new PlanningError(`Planner beliefs missing block "${block}".`, 500);
          }

          if (destination !== 'Table' && !blockExists(this.beliefs.stacks, destination)) {
            throw new PlanningError(`Planner beliefs missing destination "${destination}".`, 500);
          }

          if (!isBlockClear(this.beliefs.stacks, block)) {
            const blocker = topMostAbove(this.beliefs.stacks, block);
            if (!blocker) return null;
            return [
              {
                move: {
                  block: blocker,
                  to: 'Table',
                  reason: MOVE_REASONS.CLEAR_BLOCK,
                  target: block
                }
              }
            ];
          }

          if (destination !== 'Table' && !isBlockClear(this.beliefs.stacks, destination)) {
            const blocker = topMostAbove(this.beliefs.stacks, destination);
            if (!blocker) return null;
            return [
              {
                move: {
                  block: blocker,
                  to: 'Table',
                  reason: MOVE_REASONS.CLEAR_TARGET,
                  target: destination
                }
              }
            ];
          }

          if (isOn(this.beliefs.stacks, block, destination)) {
            return null;
          }

          return [
            {
              move: {
                block,
                to: destination,
                reason: MOVE_REASONS.STACK
              }
            }
          ];
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

function validateMoveCandidate(move, stacks) {
  if (!blockExists(stacks, move.block)) {
    return { ok: false, code: 'BLOCK_NOT_FOUND', fatal: true };
  }

  if (!isBlockClear(stacks, move.block)) {
    return { ok: false, code: 'BLOCK_NOT_CLEAR' };
  }

  if (move.block === move.to) {
    return { ok: false, code: 'BLOCK_EQUALS_DESTINATION', fatal: true };
  }

  if (move.to === 'Table') {
    return { ok: true };
  }

  if (!blockExists(stacks, move.to)) {
    return { ok: false, code: 'DESTINATION_NOT_FOUND', fatal: true };
  }

  if (!isBlockClear(stacks, move.to)) {
    return { ok: false, code: 'DESTINATION_NOT_CLEAR' };
  }

  return { ok: true };
}

function planBlocksWorld(rawStacks, rawGoalChain, options = {}) {
  const { maxIterations } = resolvePlannerOptions(options);

  const { stacks: normalizedStacks } = normalizeStacks(rawStacks);
  const sanitizedGoal = sanitizeGoalChain(rawGoalChain, normalizedStacks.flat());
  const goalChain = sanitizedGoal[sanitizedGoal.length - 1] === 'Table'
    ? sanitizedGoal
    : [...sanitizedGoal, 'Table'];

  ensureGoalFeasible(goalChain, normalizedStacks);

  const alreadySatisfied = goalAchieved(normalizedStacks, goalChain);
  if (alreadySatisfied) {
    return {
      moves: [],
      iterations: 0,
      goalAchieved: true,
      relationsResolved: Math.max(goalChain.length - 1, 0),
      agentCount: 1,
      intentionLog: [],
      plannerOptionsUsed: { maxIterations }
    };
  }

  const initialState = {
    stacks: deepCloneStacks(normalizedStacks),
    goalChain: [...goalChain],
    moves: [],
    goalAchieved: false,
    iterations: 0,
    intentionLog: []
  };

  const builderAgent = createPlannerAgent(initialState);
  const stateRef = { goalAchieved: false };

  const updateState = (actions, actorId, currentState) => {
    const nextStacks = deepCloneStacks(currentState.stacks);
    const proposedMove = extractMove(actions);
    const nextMoves = [...currentState.moves];
    const nextIntentionLog = [...currentState.intentionLog];

    let appliedMove = null;
    let skippedReason = 'no-proposal';

    if (proposedMove) {
      const validation = validateMoveCandidate(proposedMove, nextStacks);
      if (!validation.ok) {
        skippedReason = validation.code || 'invalid-move';
        if (validation.fatal) {
          throw new PlanningError(`Planner produced an invalid move (${validation.code}).`, 422);
        }
      } else {
        applyMove(nextStacks, proposedMove.block, proposedMove.to);
        appliedMove = {
          block: proposedMove.block,
          to: proposedMove.to,
          reason: proposedMove.reason,
          actor: actorId
        };
        nextMoves.push(appliedMove);
      }
    }

    const reachedGoal = goalAchieved(nextStacks, currentState.goalChain);
    stateRef.goalAchieved = reachedGoal;

    nextIntentionLog.push({
      cycle: currentState.iterations + 1,
      moves: [
        appliedMove
          ? appliedMove
          : { actor: actorId, skipped: true, reason: skippedReason }
      ],
      resultingStacks: deepCloneStacks(nextStacks)
    });

    if (!appliedMove && !reachedGoal) {
      throw new PlanningError('Planner stalled before achieving the goal.', 422);
    }

    return {
      stacks: nextStacks,
      goalChain: currentState.goalChain,
      moves: nextMoves,
      goalAchieved: reachedGoal,
      iterations: currentState.iterations + 1,
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
    [builderAgent],
    initialState,
    updateState,
    () => {},
    stateFilter,
    runner
  );

  environment.run(maxIterations);

  const finalState = environment.state;

  if (!finalState.goalAchieved) {
    throw new PlanningError(`Unable to achieve goal within ${maxIterations} iterations.`, 422);
  }

  return {
    moves: finalState.moves,
    iterations: finalState.iterations,
    goalAchieved: finalState.goalAchieved,
    relationsResolved: Math.max(goalChain.length - 1, 0),
    agentCount: 1,
    intentionLog: finalState.intentionLog,
    plannerOptionsUsed: { maxIterations }
  };
}

module.exports = {
  planBlocksWorld,
  PlanningError
};
