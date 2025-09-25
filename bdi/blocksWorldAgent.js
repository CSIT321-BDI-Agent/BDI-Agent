const {
  Agent,
  Belief,
  Desire,
  Plan,
  Environment
} = require('js-son-agent');

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
    return normalized;
  });

  const tableIndex = chain.indexOf('Table');
  if (tableIndex !== -1 && tableIndex !== chain.length - 1) {
    throw new PlanningError('"Table" can only appear as the final element in a goal chain.');
  }

  return chain;
}

function findStackIndex(stacks, block) {
  return stacks.findIndex(stack => stack.includes(block));
}

function blockExists(stacks, block) {
  return findStackIndex(stacks, block) !== -1;
}

function topMostAbove(stacks, block) {
  const stackIndex = findStackIndex(stacks, block);
  if (stackIndex === -1) return null;

  const stack = stacks[stackIndex];
  const blockIndex = stack.indexOf(block);
  if (blockIndex === stack.length - 1) {
    return null;
  }
  return stack[stack.length - 1];
}

function isBlockClear(stacks, block) {
  const stackIndex = findStackIndex(stacks, block);
  if (stackIndex === -1) return false;
  const stack = stacks[stackIndex];
  return stack[stack.length - 1] === block;
}

function deriveOnMap(stacks) {
  const on = {};
  stacks.forEach(stack => {
    stack.forEach((block, idx) => {
      on[block] = idx === 0 ? 'Table' : stack[idx - 1];
    });
  });
  return on;
}

function isOn(stacks, block, destination) {
  const onMap = deriveOnMap(stacks);
  if (!(block in onMap)) {
    return false;
  }
  return onMap[block] === destination;
}

function selectNextRelation(stacks, goalChain) {
  for (let i = goalChain.length - 1; i >= 1; i -= 1) {
    const block = goalChain[i - 1];
    const destination = goalChain[i];
    if (!isOn(stacks, block, destination)) {
      return { block, destination };
    }
  }
  return null;
}

function goalAchieved(stacks, goalChain) {
  if (!goalChain || goalChain.length < 2) {
    return true;
  }
  return selectNextRelation(stacks, goalChain) === null;
}

function applyMove(stacks, block, destination) {
  const fromIndex = findStackIndex(stacks, block);
  if (fromIndex === -1) {
    throw new PlanningError(`Move failed: block "${block}" not found in any stack.`, 422);
  }
  const fromStack = stacks[fromIndex];
  if (fromStack[fromStack.length - 1] !== block) {
    throw new PlanningError(`Move failed: block "${block}" is not clear in current state.`, 422);
  }

  fromStack.pop();
  if (fromStack.length === 0) {
    stacks.splice(fromIndex, 1);
  }

  if (destination === 'Table') {
    stacks.push([block]);
    return;
  }

  const destIndex = findStackIndex(stacks, destination);
  if (destIndex === -1) {
    throw new PlanningError(`Move failed: destination block "${destination}" not found.`, 422);
  }

  stacks[destIndex].push(block);
}

function ensureGoalFeasible(goalChain, stacks) {
  goalChain
    .filter(token => token !== 'Table')
    .forEach(block => {
      if (!blockExists(stacks, block)) {
        throw new PlanningError(`Goal references block "${block}", which is absent from the world.`);
      }
    });
}

function planBlocksWorld(rawStacks, rawGoalChain, options = {}) {
  const { maxIterations = MAX_DEFAULT_ITERATIONS } = options;

  const { stacks: normalizedStacks } = normalizeStacks(rawStacks);
  const goalChain = sanitizeGoalChain(rawGoalChain, normalizedStacks.flat());

  ensureGoalFeasible(goalChain, normalizedStacks);

  const initialGoalAchieved = goalAchieved(normalizedStacks, goalChain);
  if (initialGoalAchieved) {
    return {
      moves: [],
      iterations: 0,
      goalAchieved: true,
      relationsResolved: Math.max(goalChain.length - 1, 0)
    };
  }

  const initialState = {
    stacks: deepCloneStacks(normalizedStacks),
    goalChain: [...goalChain],
    moves: [],
    iterations: 0,
    goalAchieved: initialGoalAchieved
  };

  const desires = {
    ...Desire('achieveGoal', beliefs => !goalAchieved(beliefs.stacks, beliefs.goalChain))
  };

  const plans = [
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
          return [{ move: { block: blocker, to: 'Table', reason: 'clear-block' } }];
        }

        if (destination !== 'Table' && !isBlockClear(this.beliefs.stacks, destination)) {
          const blocker = topMostAbove(this.beliefs.stacks, destination);
          if (!blocker) {
            return null;
          }
          return [{ move: { block: blocker, to: 'Table', reason: 'clear-target' } }];
        }

        if (isOn(this.beliefs.stacks, block, destination)) {
          return null;
        }

        return [{ move: { block, to: destination, reason: 'stack' } }];
      }
    )
  ];

  const agent = new Agent({
    id: 'blocks-world-bdi-agent',
    beliefs: {
      ...Belief('stacks', deepCloneStacks(initialState.stacks)),
      ...Belief('goalChain', [...initialState.goalChain]),
      ...Belief('goalAchieved', initialState.goalAchieved)
    },
    desires,
    plans
  });

  const stateRef = { goalAchieved: initialGoalAchieved };

  const updateState = (actions, _agentId, currentState) => {
    const nextStacks = deepCloneStacks(currentState.stacks);
    const appliedMoves = [];

    if (Array.isArray(actions)) {
      actions.forEach(actionGroup => {
        if (!Array.isArray(actionGroup)) return;
        actionGroup.forEach(action => {
          if (!action || !action.move) return;
          const { block, to } = action.move;
          applyMove(nextStacks, block, to);
          appliedMoves.push({ block, to });
        });
      });
    }

    const mergedMoves = appliedMoves.length
      ? [...currentState.moves, ...appliedMoves]
      : [...currentState.moves];

    const achieved = goalAchieved(nextStacks, currentState.goalChain);
    stateRef.goalAchieved = achieved;

    return {
      stacks: nextStacks,
      moves: mergedMoves,
      goalAchieved: achieved,
      iterations: (currentState.iterations || 0) + 1
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
    [agent],
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
    relationsResolved: Math.max(goalChain.length - 1, 0)
  };
}

module.exports = {
  planBlocksWorld,
  PlanningError
};
