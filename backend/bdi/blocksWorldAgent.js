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
  deriveOnMap,
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

function clonePendingRelation(relation) {
  if (!relation) {
    return null;
  }

  return {
    block: relation.block,
    destination: relation.destination
  };
}

function extractChainBaseBlocks(goalChain) {
  if (!Array.isArray(goalChain) || goalChain.length === 0) {
    return [];
  }

  const bases = new Set();

  for (let idx = 0; idx < goalChain.length; idx += 1) {
    const token = goalChain[idx];
    if (token !== 'Table') {
      continue;
    }

    const candidate = goalChain[idx - 1];
    if (candidate && candidate !== 'Table') {
      bases.add(candidate);
    }
  }

  if (bases.size === 0) {
    const terminalToken = goalChain[goalChain.length - 1];
    if (terminalToken && terminalToken !== 'Table') {
      bases.add(terminalToken);
    }
  }

  return Array.from(bases);
}

function normalizeRequiredBaseBlocks(requiredGroundBlocks = []) {
  if (!Array.isArray(requiredGroundBlocks) || requiredGroundBlocks.length === 0) {
    return [];
  }

  return requiredGroundBlocks
    .filter(block => typeof block === 'string' && block.trim().length > 0 && block !== 'Table')
    .map(block => block.trim().toUpperCase());
}

function computeStateFacts(stacks, goalChain, requiredGroundBlocks = []) {
  const onMap = deriveOnMap(stacks);
  const clearBlocks = Object.keys(onMap)
    .filter(block => isBlockClear(stacks, block))
    .sort();

  const onTableBlocks = Object.keys(onMap)
    .filter(block => onMap[block] === 'Table')
    .sort();

  const baseRequirementSet = new Set([
    ...normalizeRequiredBaseBlocks(requiredGroundBlocks),
    ...extractChainBaseBlocks(goalChain)
  ]);

  const groundedBaseBlocks = [];
  const missingBaseBlocks = [];

  baseRequirementSet.forEach(block => {
    if (!block) {
      return;
    }

    if (onMap[block] === 'Table') {
      groundedBaseBlocks.push(block);
    } else {
      missingBaseBlocks.push(block);
    }
  });

  groundedBaseBlocks.sort();
  missingBaseBlocks.sort();

  let pendingRelation = selectNextRelation(stacks, goalChain);

  if (!pendingRelation && missingBaseBlocks.length > 0) {
    pendingRelation = {
      block: missingBaseBlocks[0],
      destination: 'Table'
    };
  }

  return {
    onMap,
    clearBlocks,
    pendingRelation: clonePendingRelation(pendingRelation),
    onTableBlocks,
    groundedBaseBlocks,
    missingBaseBlocks
  };
}

function resolvePlannerOptions(options = {}) {
  const maxIterations = Number.isFinite(options.maxIterations)
    ? Math.max(1, Math.min(Math.floor(options.maxIterations), MAX_ITERATIONS_CAP))
    : DEFAULT_MAX_ITERATIONS;

  return { maxIterations };
}

function sanitizePlannerInputs(rawStacks, rawGoalChain, options = {}) {
  const { maxIterations } = resolvePlannerOptions(options);
  const { stacks: normalizedStacks } = normalizeStacks(rawStacks);

  const sanitizedGoal = sanitizeGoalChain(
    rawGoalChain,
    normalizedStacks.flat(),
    { allowIntermediateTable: Boolean(options.allowIntermediateTable) }
  );
  const goalChain = sanitizedGoal[sanitizedGoal.length - 1] === 'Table'
    ? sanitizedGoal
    : [...sanitizedGoal, 'Table'];

  ensureGoalFeasible(goalChain, normalizedStacks);

  return { normalizedStacks, goalChain, maxIterations };
}

function createInitialPlannerState(stacks, goalChain, requiredGroundBlocks = []) {
  const baselineFacts = computeStateFacts(stacks, goalChain, requiredGroundBlocks);
  const alreadySatisfied = goalAchieved(stacks, goalChain) && baselineFacts.missingBaseBlocks.length === 0;

  if (alreadySatisfied) {
    return {
      alreadySatisfied,
      baselineFacts,
      workingStacks: deepCloneStacks(stacks),
      initialState: null
    };
  }

  const workingStacks = deepCloneStacks(stacks);
  const initialFacts = computeStateFacts(workingStacks, goalChain, requiredGroundBlocks);

  const initialState = {
    stacks: workingStacks,
    goalChain: [...goalChain],
    moves: [],
    goalAchieved: false,
    iterations: 0,
    intentionLog: [],
    onMap: initialFacts.onMap,
    clearBlocks: initialFacts.clearBlocks,
    pendingRelation: initialFacts.pendingRelation,
    onTableBlocks: initialFacts.onTableBlocks,
    groundedBaseBlocks: initialFacts.groundedBaseBlocks,
    missingBaseBlocks: initialFacts.missingBaseBlocks
  };

  return {
    alreadySatisfied,
    baselineFacts,
    workingStacks,
    initialState
  };
}

function buildPlannerResponse(state, goalChain, maxIterations, agentCount = 1) {
  return {
    moves: Array.isArray(state?.moves) ? state.moves : [],
    iterations: Number.isFinite(state?.iterations) ? state.iterations : 0,
    goalAchieved: Boolean(state?.goalAchieved),
    relationsResolved: Math.max(goalChain.length - 1, 0),
    agentCount,
    intentionLog: Array.isArray(state?.intentionLog) ? state.intentionLog : [],
    plannerOptionsUsed: { maxIterations },
    beliefs: {
      onMap: { ...(state?.onMap || {}) },
      clearBlocks: [...(state?.clearBlocks || [])],
      pendingRelation: state?.pendingRelation
        ? { ...state.pendingRelation }
        : null,
      onTableBlocks: [...(state?.onTableBlocks || [])],
      groundedBaseBlocks: [...(state?.groundedBaseBlocks || [])],
      missingBaseBlocks: [...(state?.missingBaseBlocks || [])]
    }
  };
}

function createPlannerAgent(initialBeliefs, agentId = AGENT_ID) {
  const plannerDesires = {
    ...Desire('achieveGoal', beliefs => {
      const pendingBaseCount = Array.isArray(beliefs.missingBaseBlocks)
        ? beliefs.missingBaseBlocks.length
        : 0;
      return pendingBaseCount > 0 || !goalAchieved(beliefs.stacks, beliefs.goalChain);
    })
  };

  const beliefEntries = [
    Belief('stacks', deepCloneStacks(initialBeliefs.stacks)),
    Belief('goalChain', [...initialBeliefs.goalChain]),
    Belief('onMap', { ...(initialBeliefs.onMap || {}) }),
    Belief('clearBlocks', [...(initialBeliefs.clearBlocks || [])]),
    Belief('onTableBlocks', [...(initialBeliefs.onTableBlocks || [])]),
    Belief('groundedBaseBlocks', [...(initialBeliefs.groundedBaseBlocks || [])]),
    Belief('missingBaseBlocks', [...(initialBeliefs.missingBaseBlocks || [])]),
    Belief('goalAchieved', initialBeliefs.goalAchieved)
  ];

  if (initialBeliefs.pendingRelation) {
    beliefEntries.push(Belief('pendingRelation', { ...initialBeliefs.pendingRelation }));
  }

  const agentBeliefs = Object.assign({}, ...beliefEntries);

  return new Agent({
    id: agentId,
    beliefs: agentBeliefs,
    desires: plannerDesires,
    plans: [
      Plan(
        intentions => intentions.achieveGoal,
        function planAchieveGoal() {
          const {
            stacks,
            clearBlocks = [],
            onMap = {}
          } = this.beliefs;

          const nextRelation = this.beliefs.pendingRelation
            ? { ...this.beliefs.pendingRelation }
            : selectNextRelation(stacks, this.beliefs.goalChain);

          if (!nextRelation) {
            this.beliefs.goalAchieved = true;
            if (this.beliefs.pendingRelation) {
              delete this.beliefs.pendingRelation;
            }
            return null;
          }

          this.beliefs.pendingRelation = { ...nextRelation };
          const { block, destination } = nextRelation;

          if (!blockExists(stacks, block)) {
            throw new PlanningError(`Planner beliefs missing block "${block}".`, 500);
          }

          if (destination !== 'Table' && !blockExists(stacks, destination)) {
            throw new PlanningError(`Planner beliefs missing destination "${destination}".`, 500);
          }

          const blockIsClear = clearBlocks.includes(block) || isBlockClear(stacks, block);
          if (!blockIsClear) {
            const blocker = topMostAbove(stacks, block);
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

          const destinationIsClear = destination === 'Table'
            ? true
            : clearBlocks.includes(destination) || isBlockClear(stacks, destination);
          if (destination !== 'Table' && !destinationIsClear) {
            const blocker = topMostAbove(stacks, destination);
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

          const blockAlreadyOnDestination = onMap[block] === destination || isOn(stacks, block, destination);
          if (blockAlreadyOnDestination) {
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

// Convert a logical move into 4 physical claw steps
function expandMoveToClawSteps(move, stacks) {
  const steps = [];
  
  // Step 1: Move claw to source block position
  steps.push({
    type: 'MOVE_CLAW',
    to: move.block,
    description: `Move claw to ${move.block}`
  });
  
  // Step 2: Pick up the block (attach to claw)
  steps.push({
    type: 'PICK_UP',
    block: move.block,
    description: `Pick up ${move.block}`
  });
  
  // Step 3: Move claw (with block) to destination
  steps.push({
    type: 'MOVE_CLAW',
    to: move.to,
    carrying: move.block,
    description: `Move ${move.block} to ${move.to}`
  });
  
  // Step 4: Drop the block (detach from claw)
  steps.push({
    type: 'DROP',
    block: move.block,
    at: move.to,
    description: `Drop ${move.block} on ${move.to}`
  });
  
  return steps;
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
  const { normalizedStacks, goalChain, maxIterations } = sanitizePlannerInputs(rawStacks, rawGoalChain, options);
  const requiredBaseBlocks = Array.isArray(options.requiredBaseBlocks)
    ? options.requiredBaseBlocks
    : [];
  const { alreadySatisfied, baselineFacts, initialState } = createInitialPlannerState(
    normalizedStacks,
    goalChain,
    requiredBaseBlocks
  );

  if (alreadySatisfied) {
    return buildPlannerResponse({
      moves: [],
      iterations: 0,
      goalAchieved: true,
      intentionLog: [],
      onMap: { ...baselineFacts.onMap },
      clearBlocks: [...baselineFacts.clearBlocks],
      pendingRelation: null,
      onTableBlocks: [...baselineFacts.onTableBlocks],
      groundedBaseBlocks: [...baselineFacts.groundedBaseBlocks],
      missingBaseBlocks: [...baselineFacts.missingBaseBlocks]
    }, goalChain, maxIterations);
  }

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
        
        // Generate 4-step claw movement sequence
        const clawSteps = expandMoveToClawSteps(proposedMove, currentState.stacks);
        
        appliedMove = {
          block: proposedMove.block,
          to: proposedMove.to,
          reason: proposedMove.reason,
          actor: actorId,
          clawSteps: clawSteps  // Include detailed claw steps
        };
        nextMoves.push(appliedMove);
      }
    }

    const stateFacts = computeStateFacts(nextStacks, currentState.goalChain, requiredBaseBlocks);
    const structureSatisfied = goalAchieved(nextStacks, currentState.goalChain);
    const baseSatisfied = stateFacts.missingBaseBlocks.length === 0;
    const reachedGoal = structureSatisfied && baseSatisfied;
    stateRef.goalAchieved = reachedGoal;

    // If move was applied, create 4 separate cycles (one for each claw step)
    if (appliedMove && appliedMove.clawSteps) {
      appliedMove.clawSteps.forEach((step, stepIdx) => {
        nextIntentionLog.push({
          cycle: nextIntentionLog.length + 1,
          moves: [{
            actor: actorId,
            block: step.block || appliedMove.block,
            to: step.to || (step.type === 'PICK_UP' ? 'claw' : appliedMove.to),
            reason: step.type.toLowerCase().replace('_', '-'),
            stepType: step.type,
            stepDescription: step.description,
            stepNumber: stepIdx + 1,
            totalSteps: 4
          }],
          resultingStacks: deepCloneStacks(nextStacks),
          beliefs: {
            pendingRelation: stateFacts.pendingRelation
              ? { ...stateFacts.pendingRelation }
              : null,
            clearBlocks: [...stateFacts.clearBlocks],
            onMap: { ...stateFacts.onMap },
            onTableBlocks: [...stateFacts.onTableBlocks],
            groundedBaseBlocks: [...stateFacts.groundedBaseBlocks],
            missingBaseBlocks: [...stateFacts.missingBaseBlocks]
          }
        });
      });
    } else {
      // No move applied, single skip cycle
      nextIntentionLog.push({
        cycle: nextIntentionLog.length + 1,
        moves: [{ actor: actorId, skipped: true, reason: skippedReason }],
        resultingStacks: deepCloneStacks(nextStacks),
        beliefs: {
          pendingRelation: stateFacts.pendingRelation
            ? { ...stateFacts.pendingRelation }
            : null,
          clearBlocks: [...stateFacts.clearBlocks],
          onMap: { ...stateFacts.onMap },
          onTableBlocks: [...stateFacts.onTableBlocks],
          groundedBaseBlocks: [...stateFacts.groundedBaseBlocks],
          missingBaseBlocks: [...stateFacts.missingBaseBlocks]
        }
      });
    }

    if (!appliedMove && !reachedGoal) {
      throw new PlanningError('Planner stalled before achieving the goal.', 422);
    }

    return {
      stacks: nextStacks,
      goalChain: currentState.goalChain,
      moves: nextMoves,
      goalAchieved: reachedGoal,
      iterations: currentState.iterations + 1,
      intentionLog: nextIntentionLog,
      onMap: stateFacts.onMap,
      clearBlocks: stateFacts.clearBlocks,
      pendingRelation: stateFacts.pendingRelation,
      onTableBlocks: stateFacts.onTableBlocks,
      groundedBaseBlocks: stateFacts.groundedBaseBlocks,
      missingBaseBlocks: stateFacts.missingBaseBlocks
    };
  };

  const stateFilter = state => {
    const facts = computeStateFacts(state.stacks, state.goalChain, requiredBaseBlocks);

    const filtered = {
      stacks: deepCloneStacks(state.stacks),
      goalChain: [...state.goalChain],
      goalAchieved: state.goalAchieved,
      onMap: { ...facts.onMap },
      clearBlocks: [...facts.clearBlocks],
      onTableBlocks: [...facts.onTableBlocks],
      groundedBaseBlocks: [...facts.groundedBaseBlocks],
      missingBaseBlocks: [...facts.missingBaseBlocks]
    };

    if (facts.pendingRelation) {
      filtered.pendingRelation = { ...facts.pendingRelation };
    }

    return filtered;
  };

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

  return buildPlannerResponse(finalState, goalChain, maxIterations);
}

module.exports = {
  planBlocksWorld,
  PlanningError,
  createPlannerAgent,
  computeStateFacts,
  extractMove,
  expandMoveToClawSteps,
  validateMoveCandidate,
  sanitizePlannerInputs,
  createInitialPlannerState
};
