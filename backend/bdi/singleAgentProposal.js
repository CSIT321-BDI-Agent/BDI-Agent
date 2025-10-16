/**
 * Single Agent Proposal Extractor
 * 
 * Generates move proposals using BDI planning logic without js-son-agent
 * to avoid belief iteration issues in multi-agent scenarios.
 */

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
  isBlockClear,
  selectNextRelation,
  goalAchieved,
  deriveOnMap,
  blockExists,
  topMostAbove
} = createBlocksHelpers(PlanningError);

const MOVE_REASONS = {
  CLEAR_BLOCK: 'clear-block',
  CLEAR_TARGET: 'clear-target',
  STACK: 'stack'
};

/**
 * Computes current state facts for agent beliefs
 */
function computeStateFacts(stacks, goalChain) {
  const onMap = deriveOnMap(stacks);
  const clearBlocks = Object.keys(onMap)
    .filter(block => isBlockClear(stacks, block))
    .sort();
  const pendingRelation = selectNextRelation(stacks, goalChain);

  return { onMap, clearBlocks, pendingRelation };
}

/**
 * Generates next move proposal using BDI planning logic
 * This is a pure function that doesn't use js-son-agent
 * 
 * @param {string} agentId - Agent identifier
 * @param {Array} currentStacks - Current world state
 * @param {Array} goalChain - Agent's goal chain
 * @returns {Object|null} Proposed move or null if no move needed
 */
function getSingleAgentProposal(agentId, currentStacks, goalChain, options = {}) {
  try {
    // Check if goal already achieved
    if (goalAchieved(currentStacks, goalChain)) {
      return null;
    }

    // Compute current state facts
    const { onMap, clearBlocks, pendingRelation } = computeStateFacts(currentStacks, goalChain);

    const focusRelationRaw = options?.focusRelation;
    const normalizeRelation = (relation) => {
      if (!relation || typeof relation !== 'object') {
        return null;
      }
      const { block, destination } = relation;
      if (typeof block !== 'string' || typeof destination !== 'string') {
        return null;
      }
      const normalizedBlock = block.trim().toUpperCase();
      const normalizedDestination = destination === 'Table'
        ? 'Table'
        : destination.trim().toUpperCase();
      return { block: normalizedBlock, destination: normalizedDestination };
    };

    const focusRelation = normalizeRelation(focusRelationRaw);

    const nextRelation = focusRelation || pendingRelation || selectNextRelation(currentStacks, goalChain);

    if (!nextRelation) {
      return null;  // Goal achieved
    }

    const { block, destination } = nextRelation;

    // Validate blocks exist
    if (!blockExists(currentStacks, block)) {
      throw new PlanningError(`Agent ${agentId} cannot find block "${block}".`, 500);
    }

    if (destination !== 'Table' && !blockExists(currentStacks, destination)) {
      throw new PlanningError(`Agent ${agentId} cannot find destination "${destination}".`, 500);
    }

    // Check if block needs clearing
    const blockIsClear = clearBlocks.includes(block) || isBlockClear(currentStacks, block);

    const preferredReason = options?.preferredReason;
    const canClearBlock = !blockIsClear;
    const canClearTarget = destination !== 'Table'
      ? !(clearBlocks.includes(destination) || isBlockClear(currentStacks, destination))
      : false;

    if (preferredReason === MOVE_REASONS.CLEAR_TARGET && canClearTarget) {
      const blocker = topMostAbove(currentStacks, destination);
      if (!blocker) return null;

      return {
        block: blocker.trim().toUpperCase(),
        to: 'Table',
        reason: MOVE_REASONS.CLEAR_TARGET,
        target: destination
      };
    }

    if (preferredReason === MOVE_REASONS.CLEAR_BLOCK && canClearBlock) {
      const blocker = topMostAbove(currentStacks, block);
      if (!blocker) return null;
      
      return {
        block: blocker.trim().toUpperCase(),
        to: 'Table',
        reason: MOVE_REASONS.CLEAR_BLOCK,
        target: block
      };
    }

    if (canClearBlock) {
      const blocker = topMostAbove(currentStacks, block);
      if (!blocker) return null;

      return {
        block: blocker.trim().toUpperCase(),
        to: 'Table',
        reason: MOVE_REASONS.CLEAR_BLOCK,
        target: block
      };
    }

    // Check if destination needs clearing
    const destinationIsClear = destination === 'Table'
      ? true
      : clearBlocks.includes(destination) || isBlockClear(currentStacks, destination);

    if (destination !== 'Table' && !destinationIsClear) {
      const blocker = topMostAbove(currentStacks, destination);
      if (!blocker) return null;
      
      return {
        block: blocker.trim().toUpperCase(),
        to: 'Table',
        reason: MOVE_REASONS.CLEAR_TARGET,
        target: destination
      };
    }

    // Check if already on destination
    const blockAlreadyOnDestination = onMap[block] === destination;
    
    if (blockAlreadyOnDestination) {
      return null;  // Already correct
    }

    // Propose final stack move
    return {
      block: block.trim().toUpperCase(),
      to: destination === 'Table' ? 'Table' : destination.trim().toUpperCase(),
      reason: MOVE_REASONS.STACK
    };

  } catch (error) {
    console.error(`Error getting proposal from ${agentId}:`, error.message);
    return null;
  }
}

module.exports = {
  getSingleAgentProposal,
  computeStateFacts
};
