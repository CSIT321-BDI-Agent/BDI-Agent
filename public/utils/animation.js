/**
 * Animation System for Block Movement
 * 
 * Handles visual animations for block movements including:
 * - Robotic claw animations
 * - Block transitions
 * - Timeline updates after moves
 */

import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, CLAW_HEIGHT, CLAW_OFFSET, STACK_MARGIN } from './constants.js';
import { handleError } from './helpers.js';

/**
 * Simulate a single block move with animation
 * @param {Object} move - Move object {block, to}
 * @param {Object} world - World instance
 * @param {HTMLElement} worldElem - World container element
 * @param {HTMLElement} claw - Claw element
 * @param {Function} markTimelineMove - Function to mark timeline
 * @param {Function} callback - Callback when animation completes
 */
export function simulateMove(move, world, worldElem, claw, markTimelineMove, callback) {
  const blockName = move.block;
  const dest = move.to;

  const blockDiv = worldElem?.querySelector(`[data-block='${blockName}']`);
  if (!blockDiv) {
    console.error('DOM element for block not found:', blockName);
    handleError(new Error(`Block ${blockName} not found in DOM`), 'simulateMove');
    callback();
    return;
  }

  try {
    const startLeft = parseFloat(blockDiv.style.left) || 0;
    const startTop = parseFloat(blockDiv.style.top) || 0;

    // Validate move before executing
    if (!world.blocks.includes(blockName)) {
      throw new Error(`Block ${blockName} not found in world`);
    }

    world.moveBlock(blockName, dest);
    world.updatePositions(blockName);

    const destStackIndex = world.stacks.findIndex(s => s.includes(blockName));
    if (destStackIndex === -1) {
      throw new Error(`Block ${blockName} not found after move`);
    }
    
    const destPosIndex = world.stacks[destStackIndex].indexOf(blockName);
    const destLeft = destStackIndex * (BLOCK_WIDTH + STACK_MARGIN);
    const destTop = WORLD_HEIGHT - (destPosIndex + 1) * BLOCK_HEIGHT;

    // Animate claw
    if (claw) {
      claw.style.transition = 'none';
      claw.style.left = `${startLeft + CLAW_OFFSET}px`;
      claw.style.top = `${startTop - CLAW_HEIGHT}px`;
    }

    blockDiv.classList.add('moving');

    // Force reflow
    void blockDiv.offsetWidth;

    const duration = window.APP_CONFIG?.ANIMATION_DURATION || 550;
    blockDiv.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    
    if (claw) {
      claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
      claw.style.left = `${destLeft + CLAW_OFFSET}px`;
      claw.style.top = `${destTop - CLAW_HEIGHT}px`;
    }
    
    blockDiv.style.left = `${destLeft}px`;
    blockDiv.style.top = `${destTop}px`;

    setTimeout(() => {
      try {
        blockDiv.classList.remove('moving');
        blockDiv.style.transition = '';
        if (claw) {
          claw.style.transition = '';
        }
        world.updatePositions();
        
        // Log move to Action Tower
        if (typeof window._logMove === 'function') {
          const destination = dest === 'Table' ? 'Table' : dest;
          window._logMove(`Move ${blockName} → ${destination}`);
        }
        
        markTimelineMove(move);
        callback();
      } catch (error) {
        handleError(error, 'simulateMove cleanup');
        callback();
      }
    }, duration + 10);
    
  } catch (error) {
    handleError(error, 'simulateMove');
    blockDiv?.classList.remove('moving');
    callback();
  }
}
