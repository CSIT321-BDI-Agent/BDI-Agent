/**
 * Goal Decomposition Utilities for Multi-Agent Planning
 * 
 * Splits a goal chain between two agents using horizontal split strategy
 * with overlap to enable coordination.
 */

/**
 * Decomposes goal chain into two subsets for parallel work
 * 
 * Strategy: staged split with shared overlap window
 *
 * Example: ['A', 'B', 'C', 'D', 'E', 'Table']
 *   Foundation (shared): ['C', 'D', 'E', 'Table']
 *   Assembly (top): ['A', 'B', 'C']
 *   Overlap: ['C'] keeps both agents aligned on the staging pivot
 * 
 * @param {string[]} goalChain - Full goal chain including 'Table'
 * @returns {{goalChainA: string[], goalChainB: string[], overlap: string|null}}
 */
function decomposeGoals(goalChain) {
  if (!Array.isArray(goalChain) || goalChain.length === 0) {
    throw new Error('Goal chain must be a non-empty array');
  }

  // Ensure Table anchor exists
  const normalizedChain = ensureTableAnchor(goalChain);

  // Single block case - both agents get same goal
  if (normalizedChain.length <= 2) {
    return {
      goalChainA: normalizedChain,
      goalChainB: normalizedChain,
      overlap: normalizedChain[0]
    };
  }

  // Two blocks case - split evenly
  if (normalizedChain.length === 3) {
    return {
      goalChainA: [normalizedChain[0], normalizedChain[1]],
      goalChainB: [normalizedChain[1], normalizedChain[2]],
      overlap: normalizedChain[1]
    };
  }

  // Multiple blocks - staged split (foundation + assembly)
  const relationCount = normalizedChain.length - 1; // Number of on-relations to satisfy
  const foundationRelations = Math.max(1, Math.ceil(relationCount / 2));
  const foundationStartIndex = Math.max(0, relationCount - foundationRelations);

  const foundationChain = normalizedChain.slice(foundationStartIndex);
  const assemblyChain = normalizedChain.slice(0, foundationStartIndex + 1);

  // Ensure both chains remain valid (at least two entries)
  const resolvedAssemblyChain = assemblyChain.length >= 2
    ? assemblyChain
    : ensureTableAnchor(assemblyChain);

  const resolvedFoundationChain = foundationChain.length >= 2
    ? foundationChain
    : ensureTableAnchor(foundationChain);

  const sharedBlocks = resolvedAssemblyChain.filter(block => resolvedFoundationChain.includes(block));
  const pivotBlock = sharedBlocks.length > 0
    ? sharedBlocks[sharedBlocks.length - 1]
    : resolvedFoundationChain[0];

  return {
    goalChainA: resolvedAssemblyChain,
    goalChainB: resolvedFoundationChain,
    overlap: {
      pivot: pivotBlock,
      blocks: sharedBlocks
    },
    stages: {
      foundationChain: resolvedFoundationChain,
      assemblyChain: resolvedAssemblyChain,
      pivot: pivotBlock
    }
  };
}

/**
 * Ensures goal chain ends with 'Table' anchor
 * 
 * @param {string[]} chain - Goal chain to check
 * @returns {string[]} Chain with Table anchor
 */
function ensureTableAnchor(chain) {
  if (!chain || chain.length === 0) {
    return ['Table'];
  }
  
  if (chain[chain.length - 1] !== 'Table') {
    return [...chain, 'Table'];
  }
  
  return chain;
}

/**
 * Alternative: Dynamic work queue for work-stealing approach
 * 
 * Converts goal chain into atomic work units that agents can claim
 * 
 * @param {string[]} goalChain - Full goal chain
 * @returns {Array<{block: string, destination: string, status: string, claimed: string|null}>}
 */
function createWorkQueue(goalChain) {
  const normalizedChain = ensureTableAnchor(goalChain);
  const relations = [];
  
  for (let i = 0; i < normalizedChain.length - 1; i++) {
    relations.push({
      block: normalizedChain[i],
      destination: normalizedChain[i + 1],
      status: 'pending',
      claimed: null
    });
  }
  
  return relations;
}

/**
 * Validates that goal chains are compatible (no conflicts in overlap)
 * 
 * @param {string[]} goalChainA - Agent A's goal chain
 * @param {string[]} goalChainB - Agent B's goal chain
 * @returns {{valid: boolean, error?: string}}
 */
function validateDecomposition(goalChainA, goalChainB) {
  // Check for common blocks (overlap)
  const blocksA = new Set(goalChainA.filter(b => b !== 'Table'));
  const blocksB = new Set(goalChainB.filter(b => b !== 'Table'));
  
  const overlap = [...blocksA].filter(b => blocksB.has(b));
  
  if (overlap.length === 0) {
    return {
      valid: false,
      error: 'No overlap block for coordination'
    };
  }
  
  // Overlap should be contiguous (adjacent in both chains)
  // This ensures agents can coordinate at the boundary
  
  return { valid: true };
}

module.exports = {
  decomposeGoals,
  createWorkQueue,
  ensureTableAnchor,
  validateDecomposition
};
