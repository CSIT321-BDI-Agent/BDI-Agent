/**
 * Animation System for Block Movement
 * 
 * Handles visual animations for block movements including:
 * - 4-step robotic claw sequence (move to source, pick up, move to dest, drop)
 * - Block transitions
 * - Timeline updates after moves
 */

import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, CLAW_HEIGHT, CLAW_OFFSET, STACK_MARGIN, resetClawToHome, CLAW_HOME_TOP } from './constants.js';
import { handleError } from './helpers.js';
import { logMove } from './logger.js';

const MOVING_CLASSES = ['shadow-[0_0_12px_rgba(79,209,197,0.45)]', 'ring-2', 'ring-brand-primary/50', 'scale-[1.02]'];

const MIN_AXIS_SEGMENT_DURATION = 80;
const SAFE_CLAW_TOP = CLAW_HOME_TOP;

const computeContactDuration = (stepDuration) => {
  if (!Number.isFinite(stepDuration)) {
    return 150;
  }
  const scaled = Math.round(stepDuration * 0.25);
  return Math.max(60, Math.min(600, scaled));
};

const delay = (ms) => new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms | 0)));

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

function resolveBlockTargets(step, fallbackClawPosition, previousBlock, initialBlock) {
  const fallbackLeft = Number.isFinite(fallbackClawPosition?.left)
    ? fallbackClawPosition.left - CLAW_OFFSET
    : (previousBlock?.left ?? initialBlock?.left ?? 0);

  const fallbackTop = Number.isFinite(fallbackClawPosition?.top)
    ? fallbackClawPosition.top + CLAW_HEIGHT
    : (previousBlock?.top ?? initialBlock?.top ?? 0);

  const left = Number.isFinite(step?.blockLeft)
    ? step.blockLeft
    : fallbackLeft;

  const top = Number.isFinite(step?.blockTop)
    ? step.blockTop
    : fallbackTop;

  return { left, top };
}

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

  const baseDuration = clampDuration(duration, sanitizedSteps.length) * sanitizedSteps.length;

  const clawStart = getElementPosition(claw);
  const blockStart = blockDiv ? getBlockVisualPosition(blockDiv) : null;

  const weights = [];
  let totalWeight = 0;
  let previewClaw = { ...clawStart };
  let previewBlock = blockStart ? { ...blockStart } : null;

  for (const step of sanitizedSteps) {
    const targetLeft = typeof step.clawLeft === 'number' ? step.clawLeft : previewClaw.left;
    const targetTop = typeof step.clawTop === 'number' ? step.clawTop : previewClaw.top;
    const fallbackClawPosition = { left: targetLeft, top: targetTop };

    let weight = Math.abs(targetLeft - previewClaw.left) + Math.abs(targetTop - previewClaw.top);

    if (blockDiv) {
      const priorBlockLeft = previewBlock?.left ?? blockStart?.left ?? (previewClaw.left - CLAW_OFFSET);
      const priorBlockTop = previewBlock?.top ?? blockStart?.top ?? (previewClaw.top + CLAW_HEIGHT);
      const { left: targetBlockLeft, top: targetBlockTop } = resolveBlockTargets(step, fallbackClawPosition, previewBlock, blockStart);
      const blockWeight = Math.abs(targetBlockLeft - priorBlockLeft) + Math.abs(targetBlockTop - priorBlockTop);
      weight = Math.max(weight, blockWeight);
      previewBlock = { left: targetBlockLeft, top: targetBlockTop };
    }

    if (weight < 0.5) {
      weight = 0;
    }

    weights.push(weight);
    totalWeight += weight;
    previewClaw = { left: targetLeft, top: targetTop };
  }

  if (totalWeight === 0) {
    if (duration > 0) {
      await delay(duration);
    }
    return;
  }

  const durations = new Array(sanitizedSteps.length).fill(0);
  const positiveIndices = weights
    .map((weight, idx) => (weight > 0 ? idx : -1))
    .filter(idx => idx >= 0);

  if (!positiveIndices.length) {
    if (duration > 0) {
      await delay(duration);
    }
    return;
  }

  const sharedDuration = Math.max(
    MIN_AXIS_SEGMENT_DURATION,
    Math.round(baseDuration / positiveIndices.length)
  );

  let accumulatedShared = 0;
  positiveIndices.forEach(idx => {
    durations[idx] = sharedDuration;
    accumulatedShared += sharedDuration;
  });

  if (accumulatedShared !== baseDuration) {
    const lastIdx = positiveIndices[positiveIndices.length - 1];
    durations[lastIdx] += baseDuration - accumulatedShared;
  }

  let previous = { ...clawStart };
  let previousBlock = blockStart ? { ...blockStart } : null;

  for (let idx = 0; idx < sanitizedSteps.length; idx += 1) {
    const step = sanitizedSteps[idx];
    const segmentDuration = durations[idx];
    const targetLeft = typeof step.clawLeft === 'number' ? step.clawLeft : previous.left;
    const targetTop = typeof step.clawTop === 'number' ? step.clawTop : previous.top;
    const fallbackClawPosition = { left: targetLeft, top: targetTop };
    const moveHorizontally = Math.abs(targetLeft - previous.left) > 0.5;
    const moveVertically = Math.abs(targetTop - previous.top) > 0.5;

    const priorBlockState = previousBlock
      ? { ...previousBlock }
      : blockDiv
        ? {
            left: blockStart?.left ?? (previous.left - CLAW_OFFSET),
            top: blockStart?.top ?? (previous.top + CLAW_HEIGHT)
          }
        : null;

    const { left: targetBlockLeft, top: targetBlockTop } = resolveBlockTargets(step, fallbackClawPosition, previousBlock, blockStart);
    const blockMovesHorizontally = blockDiv && priorBlockState
      ? Math.abs(targetBlockLeft - priorBlockState.left) > 0.5
      : false;
    const blockMovesVertically = blockDiv && priorBlockState
      ? Math.abs(targetBlockTop - priorBlockState.top) > 0.5
      : false;

    const nextBlockPosition = { left: targetBlockLeft, top: targetBlockTop };

    if (!moveHorizontally && !moveVertically && !blockMovesHorizontally && !blockMovesVertically) {
      previousBlock = nextBlockPosition;
      continue;
    }

    const transitions = [];
    if (moveHorizontally) transitions.push(`left ${segmentDuration}ms ease`);
    if (moveVertically) transitions.push(`top ${segmentDuration}ms ease`);
    claw.style.transition = transitions.join(', ');

    if (moveHorizontally) {
      claw.style.left = `${targetLeft}px`;
    }
    if (moveVertically) {
      claw.style.top = `${targetTop}px`;
    }

    if (blockDiv && (blockMovesHorizontally || blockMovesVertically)) {
      const blockTransitions = [];
      if (blockMovesHorizontally) {
        blockTransitions.push(`left ${segmentDuration}ms ease`);
      }
      if (blockMovesVertically) {
        blockTransitions.push(`top ${segmentDuration}ms ease`);
      }
      if (blockTransitions.length) {
        blockDiv.style.transition = blockTransitions.join(', ');
      }
      if (blockMovesHorizontally) {
        blockDiv.style.left = `${targetBlockLeft}px`;
      }
      if (blockMovesVertically) {
        blockDiv.style.top = `${targetBlockTop}px`;
      }
      previousBlock = nextBlockPosition;
    } else if (blockDiv) {
      previousBlock = nextBlockPosition;
    }

    if (segmentDuration > 0) {
      await delay(segmentDuration);
    }
    previous = { left: targetLeft, top: targetTop };
  }

  claw.style.transition = '';
  if (blockDiv) {
    blockDiv.style.transition = '';
  }
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
 * Each step counts as a separate cycle action in the timeline
 * @param {Object} move - Move object {block, to, clawSteps}
 * @param {Object} world - World instance
 * @param {HTMLElement} worldElem - World container element
 * @param {HTMLElement} claw - Claw element
 * @param {Function} markTimelineStep - Function to mark timeline step completion
 * @param {Function} callback - Callback when animation completes
 */
export async function simulateMove(move, world, worldElem, claw, markTimelineStep, callback, options = {}) {
  const blockName = move.block;
  const dest = move.to;
  const duration = Number.isFinite(options.durationMs)
    ? Math.max(100, Math.round(options.durationMs))
    : window.APP_CONFIG?.ANIMATION_DURATION || 550;

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
      markTimelineStep({ type: 'MOVE_CLAW', to: blockName, block: blockName, stepNumber: 1 });
    }
    
    // === STEP 2: Pick up block (attach to claw) ===
    MOVING_CLASSES.forEach(cls => blockDiv.classList.add(cls));
  await delay(computeContactDuration(duration));
    
    // Mark step 2 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'PICK_UP', block: blockName, stepNumber: 2 });
    }

  // === STEP 3: Apply the move in world state ===
  world.moveBlock(blockName, dest);
  world.updatePositions(blockName);

  const originalTransition = blockDiv.style.transition;
  blockDiv.style.transition = 'none';
  blockDiv.style.left = `${sourcePos.left}px`;
  blockDiv.style.top = `${sourcePos.top}px`;
  blockDiv.getBoundingClientRect();
  blockDiv.style.transition = originalTransition || '';

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
    const blockStart = getBlockVisualPosition(blockDiv);
    const raisedBlockTop = computeBlockTopForClaw(SAFE_CLAW_TOP);
    const pathToDestination = [];

    if (Math.abs(sourceClawTop - SAFE_CLAW_TOP) > 0.5 || Math.abs(blockStart.top - raisedBlockTop) > 0.5) {
      pathToDestination.push({
        clawLeft: sourceClawLeft,
        clawTop: SAFE_CLAW_TOP,
        blockLeft: blockStart.left,
        blockTop: raisedBlockTop
      });
    }

    if (Math.abs(destClawLeft - sourceClawLeft) > 0.5) {
      pathToDestination.push({
        clawLeft: destClawLeft,
        clawTop: SAFE_CLAW_TOP,
        blockLeft: destLeft,
        blockTop: raisedBlockTop
      });
    }

    if (Math.abs(destClawTop - SAFE_CLAW_TOP) > 0.5 || Math.abs(destTop - raisedBlockTop) > 0.5) {
      pathToDestination.push({
        clawLeft: destClawLeft,
        clawTop: destClawTop,
        blockLeft: destLeft,
        blockTop: destTop
      });
    }

    await animateClawPath(claw, blockDiv, pathToDestination, duration);
    
    // Mark step 3 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'MOVE_CLAW', to: dest, block: blockName, carrying: blockName, stepNumber: 3 });
    }

    // === STEP 4: Drop block (detach from claw) ===
  await delay(computeContactDuration(duration));
    
    MOVING_CLASSES.forEach(cls => blockDiv.classList.remove(cls));
    blockDiv.style.transition = '';
    world.updatePositions();
    
    // Mark step 4 complete in timeline
    if (typeof markTimelineStep === 'function') {
      markTimelineStep({ type: 'DROP', block: blockName, at: dest, stepNumber: 4 });
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
    logMove(`Move ${blockName} → ${destination}`);
    
    callback();
    
  } catch (error) {
    handleError(error, 'simulateMove');
    MOVING_CLASSES.forEach(cls => blockDiv?.classList.remove(cls));
    callback();
  }
}

