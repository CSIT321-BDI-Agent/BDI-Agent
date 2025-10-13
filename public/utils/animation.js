/**
 * Animation System for Block Movement
 * 
 * Handles visual animations for block movements including:
 * - 4-step robotic claw sequence (move to source, pick up, move to dest, drop)
 * - Block transitions
 * - Timeline updates after moves
 */

import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, CLAW_HEIGHT, CLAW_OFFSET, STACK_MARGIN, resetClawToHome } from './constants.js';
import { handleError } from './helpers.js';
import { logMove } from './logger.js';

const MOVING_CLASSES = ['shadow-[0_0_12px_rgba(79,209,197,0.45)]', 'ring-2', 'ring-brand-primary/50', 'scale-[1.02]'];

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
 * Each step counts as a separate cycle action in the timeline
 * @param {Object} move - Move object {block, to, clawSteps}
 * @param {Object} world - World instance
 * @param {HTMLElement} worldElem - World container element
 * @param {HTMLElement} claw - Claw element
 * @param {Function} markTimelineStep - Function to mark timeline step completion
 * @param {Function} callback - Callback when animation completes
 */
export async function simulateMove(move, world, worldElem, claw, markTimelineStep, callback) {
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
    
    // Mark step 1 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'MOVE_CLAW', to: blockName, block: blockName, stepNumber: 1 });
    }
    
    // === STEP 2: Pick up block (attach to claw) ===
    MOVING_CLASSES.forEach(cls => blockDiv.classList.add(cls));
    await new Promise(resolve => setTimeout(resolve, 150)); // Brief pause for "grab"
    
    // Mark step 2 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'PICK_UP', block: blockName, stepNumber: 2 });
    }

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

    // === STEP 3: Move claw (with block) to destination ===
    blockDiv.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    blockDiv.style.left = `${destLeft}px`;
    blockDiv.style.top = `${destTop}px`;
    
    await animateClawTo(claw, destClawLeft, destClawTop, duration);
    
    // Mark step 3 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'MOVE_CLAW', to: dest, block: blockName, carrying: blockName, stepNumber: 3 });
    }

    // === STEP 4: Drop block (detach from claw) ===
    await new Promise(resolve => setTimeout(resolve, 150)); // Brief pause for "release"
    
    MOVING_CLASSES.forEach(cls => blockDiv.classList.remove(cls));
    blockDiv.style.transition = '';
    world.updatePositions();
    
    // Mark step 4 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'DROP', block: blockName, at: dest, stepNumber: 4 });
    }
    
    // Log complete move to Action Log
    const destination = dest === 'Table' ? 'Table' : dest;
    logMove(`Move ${blockName} → ${destination}`);
    
    callback();
    
  } catch (error) {
    handleError(error, 'simulateMove');
    MOVING_CLASSES.forEach(cls => blockDiv?.classList.remove(cls));
    callback();
  }
}

