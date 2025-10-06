/**
 * Animation System for Block Movement
 * 
 * Handles visual animations for block movements including:
 * - 4-step robotic claw sequence (move to source, pick up, move to dest, drop)
 * - Block transitions
 * - Timeline updates after moves
 */

import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, CLAW_HEIGHT, CLAW_OFFSET, STACK_MARGIN, resetClawToDefault } from './constants.js';
import { handleError } from './helpers.js';

/**
 * Calculate the position of a block in the world
 * @param {Object} world - World instance
 * @param {string} blockName - Block name
 * @returns {Object} - {left, top, stackIndex, posInStack}
 */
function getBlockPosition(world, blockName) {
  const stackIndex = world.stacks.findIndex(s => s.includes(blockName));
  if (stackIndex === -1) return null;
  
  const posInStack = world.stacks[stackIndex].indexOf(blockName);
  const left = stackIndex * (BLOCK_WIDTH + STACK_MARGIN);
  const top = WORLD_HEIGHT - (posInStack + 1) * BLOCK_HEIGHT;
  
  return { left, top, stackIndex, posInStack };
}

/**
 * Animate claw movement to a position
 * @param {HTMLElement} claw - Claw element
 * @param {number} targetLeft - Target left position
 * @param {number} targetTop - Target top position
 * @param {number} duration - Animation duration in ms
 * @returns {Promise} - Resolves when animation completes
 */
function animateClawTo(claw, targetLeft, targetTop, duration) {
  return new Promise(resolve => {
    if (!claw) {
      resolve();
      return;
    }
    
    claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    claw.style.left = `${targetLeft}px`;
    claw.style.top = `${targetTop}px`;
    
    setTimeout(resolve, duration);
  });
}

/**
 * Simulate a single block move with 4-step claw animation
 * @param {Object} move - Move object {block, to, clawSteps}
 * @param {Object} world - World instance
 * @param {HTMLElement} worldElem - World container element
 * @param {HTMLElement} claw - Claw element
 * @param {Function} markTimelineMove - Function to mark timeline
 * @param {Function} callback - Callback when animation completes
 */
export async function simulateMove(move, world, worldElem, claw, markTimelineMove, callback) {
  const blockName = move.block;
  const dest = move.to;
  const duration = window.APP_CONFIG?.ANIMATION_DURATION || 550;

  const blockDiv = worldElem?.querySelector(`[data-block='${blockName}']`);
  if (!blockDiv) {
    handleError(new Error(`Block ${blockName} not found in DOM`), 'simulateMove');
    callback();
    return;
  }

  try {
    // Validate move before executing
    if (!world.blocks.includes(blockName)) {
      throw new Error(`Block ${blockName} not found in world`);
    }

    // Get initial block position
    const sourcePos = getBlockPosition(world, blockName);
    if (!sourcePos) {
      throw new Error(`Could not determine position of block ${blockName}`);
    }

    // === STEP 1: Move claw to source block ===
    const sourceClawLeft = sourcePos.left + CLAW_OFFSET;
    const sourceClawTop = sourcePos.top - CLAW_HEIGHT;
    await animateClawTo(claw, sourceClawLeft, sourceClawTop, duration);
    
    // === STEP 2: Pick up block (attach to claw) ===
    blockDiv.classList.add('moving');
    await new Promise(resolve => setTimeout(resolve, 150)); // Brief pause for "grab"

    // === STEP 3: Apply the move in world state ===
    world.moveBlock(blockName, dest);
    world.updatePositions(blockName);

    // Get destination position
    const destPos = getBlockPosition(world, blockName);
    if (!destPos) {
      throw new Error(`Block ${blockName} not found after move`);
    }

    const destLeft = destPos.left;
    const destTop = destPos.top;
    const destClawLeft = destLeft + CLAW_OFFSET;
    const destClawTop = destTop - CLAW_HEIGHT;

    // === STEP 3 continued: Move claw (with block) to destination ===
    blockDiv.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    blockDiv.style.left = `${destLeft}px`;
    blockDiv.style.top = `${destTop}px`;
    
    await animateClawTo(claw, destClawLeft, destClawTop, duration);

    // === STEP 4: Drop block (detach from claw) ===
    await new Promise(resolve => setTimeout(resolve, 150)); // Brief pause for "release"
    
    blockDiv.classList.remove('moving');
    blockDiv.style.transition = '';
    world.updatePositions();
    
    // Log move to Action Tower
    if (typeof window._logMove === 'function') {
      const destination = dest === 'Table' ? 'Table' : dest;
      window._logMove(`Move ${blockName} → ${destination}`);
    }
    
    markTimelineMove(move);
    callback();
    
  } catch (error) {
    handleError(error, 'simulateMove');
    blockDiv?.classList.remove('moving');
    callback();
  }
}
