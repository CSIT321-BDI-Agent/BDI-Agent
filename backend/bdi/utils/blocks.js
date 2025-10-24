function createBlocksHelpers(PlanningError) {
  const MAX_BLOCK_REGEX = /^[A-Z]$/;

  function deepCloneStacks(stacks) {
    return stacks.map(stack => [...stack]);
  }

  function computeClearBlocks(stacks) {
    if (!Array.isArray(stacks)) {
      return [];
    }

    const clear = new Set();

    stacks.forEach(stack => {
      if (Array.isArray(stack) && stack.length > 0) {
        clear.add(stack[stack.length - 1]);
      }
    });

    return Array.from(clear).sort();
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
        if (!MAX_BLOCK_REGEX.test(value)) {
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

  function sanitizeGoalChain(rawGoalChain, availableBlocks, options = {}) {
    const { allowIntermediateTable = false } = options;

    if (!Array.isArray(rawGoalChain) || rawGoalChain.length < 2) {
  throw new PlanningError('Goal chain must include at least two identifiers (e.g., "A, B").');
    }

    const chain = rawGoalChain.map((token, index) => {
      if (typeof token !== 'string') {
        throw new PlanningError(`Goal token at position ${index} must be a string.`);
      }
      const normalized = token.trim().toUpperCase();
      if (normalized === 'TABLE') {
        return 'Table';
      }
      if (!MAX_BLOCK_REGEX.test(normalized)) {
        throw new PlanningError(`Goal token "${token}" is invalid. Use block letters A-Z.`);
      }
      if (!availableBlocks.includes(normalized)) {
        throw new PlanningError(`Goal references unknown block "${normalized}".`);
      }
      return normalized;
    });

    if (!allowIntermediateTable) {
      const tableIndex = chain.indexOf('Table');
      if (tableIndex !== -1 && tableIndex !== chain.length - 1) {
        throw new PlanningError('"Table" can only appear as the final element in a goal chain.');
      }
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
      if (block === 'Table') {
        continue;
      }
      if (!isOn(stacks, block, destination)) {
        return { block, destination };
      }
    }
    return null;
  }

  function listPendingRelations(stacks, goalChain) {
    if (!Array.isArray(goalChain) || goalChain.length < 2) {
      return [];
    }

    const pending = [];
    for (let i = goalChain.length - 1; i >= 1; i -= 1) {
      const block = goalChain[i - 1];
      const destination = goalChain[i];
      if (block === 'Table') {
        continue;
      }
      if (!isOn(stacks, block, destination)) {
        pending.push({ block, destination });
      }
    }
    return pending;
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
    const seen = new Set();

    goalChain
      .filter(token => token !== 'Table')
      .forEach(block => {
        if (seen.has(block)) {
          throw new PlanningError(`Goal chain repeats block "${block}", which would create a loop. Use each block at most once.`, 400);
        }
        seen.add(block);

        if (!blockExists(stacks, block)) {
          throw new PlanningError(`Goal references block "${block}", which is absent from the world.`, 400);
        }
      });
  }

  return {
    deepCloneStacks,
    normalizeStacks,
    sanitizeGoalChain,
    findStackIndex,
    blockExists,
    topMostAbove,
    isBlockClear,
    deriveOnMap,
    isOn,
    selectNextRelation,
    listPendingRelations,
    goalAchieved,
    applyMove,
    ensureGoalFeasible,
    computeClearBlocks
  };
}

module.exports = createBlocksHelpers;
