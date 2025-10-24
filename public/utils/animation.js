/**
 * Animation System for Block Movement
 * 
 * Handles visual animations for block movements including:
 * - 4-step robotic claw sequence (move to source, pick up, move to dest, drop)
 * - Block transitions
 * - Timeline updates after moves
 * - Freeze/pause on user intervention
 */

import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, CLAW_HEIGHT, CLAW_OFFSET, STACK_MARGIN, resetClawToHome, CLAW_HOME_TOP } from './constants.js';
import { handleError } from './helpers.js';
import { logMove } from './logger.js';

const MOVING_CLASSES = ['shadow-[0_0_12px_rgba(79,209,197,0.45)]', 'ring-2', 'ring-brand-primary/50', 'scale-[1.02]'];

const MIN_AXIS_SEGMENT_DURATION = 80;
const SAFE_CLAW_TOP = CLAW_HOME_TOP;

// Global animation freeze state
let animationFrozen = false;
let freezeResolvers = [];

/**
 * Freeze all ongoing animations
 */
export function freezeAnimations() {
  animationFrozen = true;
}

/**
 * Resume all frozen animations
 */
export function resumeAnimations() {
  animationFrozen = false;
  // Resolve all waiting promises
  freezeResolvers.forEach(resolve => resolve());
  freezeResolvers = [];
}

/**
 * Check if animations are currently frozen
 */
export function areAnimationsFrozen() {
  return animationFrozen;
}

/**
 * Wait while animations are frozen
 */
async function waitWhileFrozen() {
  if (!animationFrozen) return;
  
  return new Promise(resolve => {
    freezeResolvers.push(resolve);
  });
}

const computeContactDuration = (stepDuration) => {
  if (!Number.isFinite(stepDuration)) {
    return 150;
  }
  const scaled = Math.round(stepDuration * 0.25);
  return Math.max(60, Math.min(600, scaled));
};

const delay = (ms) => new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms | 0)));

function syncBlockWithClaw(claw, blockDiv) {
  if (!claw || !blockDiv) {
    return;
  }

  const previousTransition = blockDiv.style.transition;
  blockDiv.style.transition = 'none';
  const clawPosition = getElementPosition(claw);
  const newLeft = clawPosition.left - CLAW_OFFSET;
  const newTop = computeBlockTopForClaw(clawPosition.top);
  blockDiv.style.left = `${newLeft}px`;
  blockDiv.style.top = `${newTop}px`;
  blockDiv.getBoundingClientRect();
  blockDiv.style.transition = previousTransition || '';
}

function attachBlockToClaw(claw, blockDiv, blockName) {
  if (!claw || !blockDiv) {
    return;
  }

  claw.dataset.carryingBlock = blockName || blockDiv.dataset.block || '';
  blockDiv.dataset.attachedToClaw = 'true';
  if (!blockDiv.dataset.originalZIndex) {
    blockDiv.dataset.originalZIndex = blockDiv.style.zIndex || '';
  }
  blockDiv.style.zIndex = '2000';
  syncBlockWithClaw(claw, blockDiv);
}

function detachBlockFromClaw(claw, blockDiv) {
  if (claw) {
    delete claw.dataset.carryingBlock;
  }
  if (!blockDiv) {
    return;
  }

  delete blockDiv.dataset.attachedToClaw;
  const previousZ = blockDiv.dataset.originalZIndex;
  if (previousZ !== undefined) {
    blockDiv.style.zIndex = previousZ;
  }
  delete blockDiv.dataset.originalZIndex;
}

function getElementPosition(element) {
  if (!element) {
    return { left: 0, top: 0 };
  }
  const style = window.getComputedStyle(element);
  const left = Number.parseFloat(style.left) || 0;
  const top = Number.parseFloat(style.top) || 0;
  return { left, top };
}

function getBlockVisualPosition(blockDiv) {
  if (!blockDiv) {
    return { left: 0, top: 0 };
  }
  const left = Number.parseFloat(blockDiv.style.left) || 0;
  const top = Number.parseFloat(blockDiv.style.top) || 0;
  return { left, top };
}

const clampDuration = (duration, segments) => {
  const base = Math.max(duration, MIN_AXIS_SEGMENT_DURATION * Math.max(1, segments));
  return Math.max(MIN_AXIS_SEGMENT_DURATION, Math.round(base / Math.max(1, segments)));
};

function computeBlockTopForClaw(clawTop) {
  return clawTop + CLAW_HEIGHT;
}



/**
 * Linear interpolation helper
 */
function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Easing function - can be changed to ease-in-out if needed
 */
function easeLinear(t) {
  return t;
}

/**
 * RAF-based animation loop - frame-perfect synchronization
 * Now supports freeze/resume for user interventions
 */
async function animateClawPath(claw, blockDiv, steps, duration) {
  if (!claw || !Array.isArray(steps) || steps.length === 0) {
    if (duration > 0) {
      await delay(duration);
    }
    return;
  }

  const sanitizedSteps = steps.filter(Boolean);
  if (!sanitizedSteps.length) {
    if (duration > 0) {
      await delay(duration);
    }
    return;
  }

  // Clear any CSS transitions - we're doing manual animation
  claw.style.transition = 'none';
  if (blockDiv) {
    blockDiv.style.transition = 'none';
  }

  const perSegmentDuration = clampDuration(duration, sanitizedSteps.length);
  const blockAttached = Boolean(blockDiv?.dataset?.attachedToClaw === 'true');
  
  // Build waypoints array from current position through all steps
  const clawStart = getElementPosition(claw);
  const waypoints = [{ claw: { ...clawStart }, duration: 0 }];
  
  let currentClaw = { ...clawStart };
  
  for (const step of sanitizedSteps) {
    const targetLeft = typeof step.clawLeft === 'number' ? step.clawLeft : currentClaw.left;
    const targetTop = typeof step.clawTop === 'number' ? step.clawTop : currentClaw.top;
    
    waypoints.push({
      claw: { left: targetLeft, top: targetTop },
      duration: perSegmentDuration
    });
    
    currentClaw = { left: targetLeft, top: targetTop };
  }

  // Animate through waypoints using RAF
  return new Promise((resolve) => {
    let currentWaypointIndex = 1;
    let segmentStartTime = performance.now();
    let animationFrameId = null;
    let frozenSince = null;

    const animate = async (currentTime) => {
      // Check if we need to freeze
      if (animationFrozen) {
        if (!frozenSince) {
          frozenSince = currentTime;
        }
        // Wait for resume
        await waitWhileFrozen();
        // Resume animation - adjust timing
        const freezeDuration = performance.now() - frozenSince;
        segmentStartTime += freezeDuration;
        frozenSince = null;
        animationFrameId = window.requestAnimationFrame(animate);
        return;
      }

      if (currentWaypointIndex >= waypoints.length) {
        // Animation complete
        resolve();
        return;
      }

      const prevWaypoint = waypoints[currentWaypointIndex - 1];
      const currentWaypoint = waypoints[currentWaypointIndex];
      const segmentDuration = currentWaypoint.duration;

      if (segmentDuration === 0) {
        // Skip zero-duration segments
        currentWaypointIndex++;
        segmentStartTime = currentTime;
        animationFrameId = window.requestAnimationFrame(animate);
        return;
      }

      const elapsed = currentTime - segmentStartTime;
      const progress = Math.min(elapsed / segmentDuration, 1);
      const t = easeLinear(progress);

      // Interpolate claw position
      const clawLeft = lerp(prevWaypoint.claw.left, currentWaypoint.claw.left, t);
      const clawTop = lerp(prevWaypoint.claw.top, currentWaypoint.claw.top, t);

      claw.style.left = `${clawLeft}px`;
      claw.style.top = `${clawTop}px`;

      // If block is attached, keep it perfectly synced with claw
      if (blockDiv && blockAttached) {
        const blockLeft = clawLeft - CLAW_OFFSET;
        const blockTop = computeBlockTopForClaw(clawTop);
        blockDiv.style.left = `${blockLeft}px`;
        blockDiv.style.top = `${blockTop}px`;
      }

      if (progress >= 1) {
        // Move to next segment
        currentWaypointIndex++;
        segmentStartTime = currentTime;
      }

      if (currentWaypointIndex < waypoints.length) {
        animationFrameId = window.requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    animationFrameId = window.requestAnimationFrame(animate);
  });
}

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
 * Simulate a single block move with 4-step claw animation
 * Each step is treated as a single timeline update for the plan
 * Now supports conflict detection and automatic table placement
 * @param {Object} move - Move object {block, to, clawSteps}
 * @param {Object} world - World instance
 * @param {HTMLElement} worldElem - World container element
 * @param {HTMLElement} claw - Claw element
 * @param {Function} markTimelineStep - Function to mark timeline step completion
 * @param {Function} callback - Callback when animation completes
 * @param {Object} options - Options including onConflictDetected callback
 */
export async function simulateMove(move, world, worldElem, claw, markTimelineStep, callback, options = {}) {
  const blockName = move.block;
  const originalDest = move.to;
  let dest = originalDest;
  const actor = move.actor || 'Agent-A';
  const duration = Number.isFinite(options.durationMs)
    ? Math.max(100, Math.round(options.durationMs))
    : window.APP_CONFIG?.ANIMATION_DURATION || 550;

  console.log(`[ANIM START] ${actor}: ${blockName} → ${dest} (duration: ${duration}ms)`);

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
    const currentClawPos = getElementPosition(claw);
    const pathToSource = [];
    if (Math.abs(currentClawPos.top - SAFE_CLAW_TOP) > 0.5) {
      pathToSource.push({ clawLeft: currentClawPos.left, clawTop: SAFE_CLAW_TOP });
    }
    if (Math.abs(sourceClawLeft - currentClawPos.left) > 0.5) {
      pathToSource.push({ clawLeft: sourceClawLeft, clawTop: SAFE_CLAW_TOP });
    }
    if (Math.abs(sourceClawTop - SAFE_CLAW_TOP) > 0.5) {
      pathToSource.push({ clawLeft: sourceClawLeft, clawTop: sourceClawTop });
    }
    await animateClawPath(claw, null, pathToSource, duration);
    
    // Mark step 1 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'MOVE_CLAW', to: blockName, block: blockName, actor, stepNumber: 1 });
    }
    
    // === STEP 2: Pick up block (attach to claw) ===
    MOVING_CLASSES.forEach(cls => blockDiv.classList.add(cls));
    await delay(computeContactDuration(duration));
    attachBlockToClaw(claw, blockDiv, blockName);
    
    // Mark step 2 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'PICK_UP', block: blockName, actor, stepNumber: 2 });
    }

    // === CONFLICT DETECTION: Check if destination is still valid ===
    let conflictDetected = false;
    if (dest !== 'Table' && !world.isClear(dest)) {
      // Destination is blocked - force place on table
      conflictDetected = true;
      console.log(`[CONFLICT] ${actor}: Destination ${dest} is blocked. Placing ${blockName} on table instead.`);
      dest = 'Table';
      
      // Notify controller about conflict
      if (typeof options.onConflictDetected === 'function') {
        options.onConflictDetected({
          block: blockName,
          originalDest,
          actualDest: 'Table',
          reason: 'destination-blocked',
          actor
        });
      }
    }

    // === STEP 3: Apply the move in world state ===
    // Update logical world state first so downstream consumers (timeline, stats) stay in sync
    world.moveBlock(blockName, dest);
    // Realign every other block immediately (skip the one currently attached to the claw)
    // so the destination stack is already in place when the claw arrives.
    world.updatePositions(blockName);

    // Calculate destination position based on new world state
    const destPos = getBlockPosition(world, blockName);
    if (!destPos) {
      throw new Error(`Block ${blockName} not found after move`);
    }

    const destLeft = destPos.left;
    const destTop = destPos.top;
    const destClawLeft = destLeft + CLAW_OFFSET;
    const destClawTop = destTop - CLAW_HEIGHT;

    // === STEP 3: Move claw (with block) to destination ===
    const blockStart = getBlockVisualPosition(blockDiv);
    const raisedBlockTop = computeBlockTopForClaw(SAFE_CLAW_TOP);
    const pathToDestination = [];

    const needsSourceLift = Math.abs(sourceClawTop - SAFE_CLAW_TOP) > 0.5 || Math.abs(blockStart.top - raisedBlockTop) > 0.5;
    if (needsSourceLift) {
      pathToDestination.push({
        clawLeft: sourceClawLeft,
        clawTop: SAFE_CLAW_TOP
      });
    }

    const needsHorizontalTravel = Math.abs(destClawLeft - sourceClawLeft) > 0.5 || Math.abs(destLeft - blockStart.left) > 0.5;
    if (needsHorizontalTravel) {
      pathToDestination.push({
        clawLeft: destClawLeft,
        clawTop: SAFE_CLAW_TOP
      });
    }

    const needsDrop = Math.abs(destClawTop - SAFE_CLAW_TOP) > 0.5 || Math.abs(destTop - raisedBlockTop) > 0.5;
    if (needsDrop) {
      pathToDestination.push({
        clawLeft: destClawLeft,
        clawTop: destClawTop
      });
    }

    await animateClawPath(claw, blockDiv, pathToDestination, duration);
    
    // Mark step 3 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'MOVE_CLAW', to: dest, block: blockName, carrying: blockName, actor, stepNumber: 3 });
    }

    // === STEP 4: Drop block (detach from claw) ===
    await delay(computeContactDuration(duration));
    detachBlockFromClaw(claw, blockDiv);

    MOVING_CLASSES.forEach(cls => blockDiv.classList.remove(cls));
    blockDiv.style.transition = '';
    
    // Manually position block at destination (updatePositions will be called by executor after all parallel moves)
    blockDiv.style.left = `${destPos.left}px`;
    blockDiv.style.top = `${destPos.top}px`;
    
    // Mark step 4 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'DROP', block: blockName, at: dest, actor, stepNumber: 4 });
    }

    const raiseAfterDrop = [];
    if (Math.abs(destClawTop - SAFE_CLAW_TOP) > 0.5) {
      raiseAfterDrop.push({ clawLeft: destClawLeft, clawTop: SAFE_CLAW_TOP });
    }
    if (raiseAfterDrop.length) {
      await animateClawPath(claw, null, raiseAfterDrop, duration);
    }
    
    // Log complete move to Action Log
    const destination = dest === 'Table' ? 'Table' : dest;
    const logMessage = conflictDetected 
      ? `Move ${blockName} → ${destination} (conflict: ${originalDest} blocked)`
      : `Move ${blockName} → ${destination}`;
    logMove(logMessage);
    
    console.log(`[ANIM END] ${actor}: ${blockName} → ${dest} completed`);
    callback();
    
  } catch (error) {
    console.log(`[ANIM ERROR] ${actor}: ${blockName} →`, error.message);
    handleError(error, 'simulateMove');
    detachBlockFromClaw(claw, blockDiv);
    MOVING_CLASSES.forEach(cls => blockDiv?.classList.remove(cls));
    callback();
  }
}

