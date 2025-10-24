import { BLOCK_WIDTH, BLOCK_HEIGHT, STACK_MARGIN, WORLD_HEIGHT } from './constants.js';
import { showMessage } from './helpers.js';
import { freezeAnimations, resumeAnimations } from './animation.js';

const DRAGGING_CLASSES = ['ring-2', 'ring-brand-primary/60', 'shadow-xl', 'cursor-grabbing'];

export class BlockDragManager {
  constructor(world, container) {
    this.world = world;
    this.container = container;
    this.enabled = false;
    this.dragState = null;
    this.onUserMutation = null;
    this.lockedBlocks = new Set();

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
  }

  setWorld(world) {
    this.world = world;
  }

  setContainer(container) {
    if (this.container === container) {
      return;
    }
    this.detachListeners();
    this.container = container;
    if (this.enabled) {
      this.attachListeners();
    }
    this.lockedBlocks.forEach(block => this.applyLockState(block, true));
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.attachListeners();
    this.lockedBlocks.forEach(block => this.applyLockState(block, true));
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.detachListeners();
    this.resetDragState();
  }

  attachListeners() {
    if (!this.container) return;
    this.container.addEventListener('pointerdown', this.handlePointerDown);
    document.addEventListener('pointermove', this.handlePointerMove);
    document.addEventListener('pointerup', this.handlePointerUp);
    document.addEventListener('pointercancel', this.handlePointerCancel);
  }

  detachListeners() {
    if (!this.container) return;
    this.container.removeEventListener('pointerdown', this.handlePointerDown);
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerup', this.handlePointerUp);
    document.removeEventListener('pointercancel', this.handlePointerCancel);
  }

  handlePointerDown(event) {
    if (!this.enabled || !this.world) return;
    if (!event.isPrimary || event.button !== 0) return;

    const blockElem = event.target.closest('[data-block]');
    if (!blockElem || !this.container.contains(blockElem)) return;

    const blockName = blockElem.dataset.block;
    if (!blockName) return;
    if (this.isLocked(blockName)) {
      return;
    }

    // Freeze any ongoing agent animations
    freezeAnimations();

    const rect = blockElem.getBoundingClientRect();
    const originSupport = this.world.on[blockName] || 'Table';
    const originStackIndex = this.world.stacks.findIndex(stack => stack.includes(blockName));
    let blockedDestinations = new Set();

    if (originStackIndex !== -1) {
      const stackSnapshot = [...this.world.stacks[originStackIndex]];
      const position = stackSnapshot.indexOf(blockName);
      if (position !== -1) {
        blockedDestinations = new Set(stackSnapshot.slice(position + 1));
      }
    }
    let detachInfo = null;

    try {
      detachInfo = this.world.detachBlock(blockName);
    } catch (error) {
      console.error('BlockDragManager: unable to detach block for dragging', error);
      showMessage('Unable to pick up that block right now.', 'error');
      // Resume animations if we failed
      resumeAnimations();
      return;
    }

    this.dragState = {
      block: blockName,
      element: blockElem,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalTransition: blockElem.style.transition,
      originalLeft: blockElem.style.left,
      originalTop: blockElem.style.top,
      originSupport,
      detachInfo,
      blockedDestinations
    };

    blockElem.setPointerCapture(event.pointerId);
    blockElem.style.transition = 'none';
    DRAGGING_CLASSES.forEach(cls => blockElem.classList.add(cls));
    event.preventDefault();
  }

  handlePointerMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    const { element, offsetX, offsetY } = this.dragState;
    const containerRect = this.container.getBoundingClientRect();
    const left = event.clientX - containerRect.left - offsetX;
    const top = event.clientY - containerRect.top - offsetY;

    element.style.left = `${Math.max(0, Math.min(left, this.container.offsetWidth - BLOCK_WIDTH))}px`;
    element.style.top = `${Math.max(0, Math.min(top, WORLD_HEIGHT - BLOCK_HEIGHT))}px`;
  }

  handlePointerUp(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    this.finalizeDrag(event);
  }

  handlePointerCancel(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    this.cancelDrag();
  }

  finalizeDrag(event) {
    const state = this.dragState;
    if (!state) {
      return;
    }

    const { block, element, originalTransition, originSupport, detachInfo } = state;
    element.releasePointerCapture(state.pointerId);

    element.style.transition = originalTransition || '';
    DRAGGING_CLASSES.forEach(cls => element.classList.remove(cls));

    const destination = this.resolveDropTarget(event);
    this.resetDragState();

    if (!destination) {
      this.world.restoreDetachedBlock(block, detachInfo);
      // Resume animations after drag cancelled
      resumeAnimations();
      return;
    }

    const { type, target } = destination;
    const normalizedDest = type === 'table' ? 'Table' : target;

    if (!this.isMoveMeaningful(block, normalizedDest, originSupport)) {
      this.world.restoreDetachedBlock(block, detachInfo);
      // Resume animations after drag cancelled
      resumeAnimations();
      return;
    }

    if (!this.isDestinationValid(block, normalizedDest, state)) {
      showMessage(`Cannot move ${block} onto ${normalizedDest}.`, 'warning');
      this.world.restoreDetachedBlock(block, detachInfo);
      // Resume animations after drag cancelled
      resumeAnimations();
      return;
    }

    try {
      const dropOptions = type === 'table'
        ? { preferredStackIndex: destination.stackIndex }
        : {};
      this.world.placeBlock(block, normalizedDest, dropOptions);
      
      // Resume animations BEFORE triggering mutation callback.
      // This timing is intentional: resuming animations first prevents blocking the replan,
      // ensuring that any subsequent mutation (e.g., replan) can proceed smoothly.
      resumeAnimations();
      
      if (typeof this.onUserMutation === 'function') {
        this.onUserMutation({
          type: 'MOVE',
          block,
          to: normalizedDest,
          from: originSupport,
          payload: {
            detachInfo,
            dropType: type,
            blockedDestinations: Array.from(state.blockedDestinations || [])
          }
        });
      }
    } catch (error) {
      console.error('BlockDragManager: failed to apply move', error);
      showMessage('Unable to complete that move.', 'error');
      this.world.restoreDetachedBlock(block, detachInfo);
      // Resume animations after error
      resumeAnimations();
    }
  }

  cancelDrag() {
    const state = this.dragState;
    if (!state) {
      return;
    }

    const { element, originalTransition, detachInfo, block } = state;
    element?.releasePointerCapture?.(state.pointerId);
    if (element) {
      element.style.transition = originalTransition || '';
      DRAGGING_CLASSES.forEach(cls => element.classList.remove(cls));
    }

    this.resetDragState();
    this.world?.restoreDetachedBlock(block, detachInfo);
    
    // Resume animations after cancel
    resumeAnimations();
  }

  resetDragState() {
    this.dragState = null;
  }

  isMoveMeaningful(block, destination, originSupport) {
    if (destination === originSupport) {
      return false;
    }
    return true;
  }

  isDestinationValid(block, destination, state) {
    if (!this.world) return false;
    if (destination === 'Table') {
      return true;
    }
    if (!this.world.blocks.includes(destination)) {
      return false;
    }
    if (block === destination) {
      return false;
    }
    if (state?.blockedDestinations?.has(destination)) {
      return false;
    }
    return this.world.isClear(destination);
  }

  resolveDropTarget(event) {
    if (!this.container) return null;

    const containerRect = this.container.getBoundingClientRect();
    const relativeX = event.clientX - containerRect.left;

    if (relativeX < 0 || this.world.stacks.length === 0) {
      return { type: 'table', target: 'Table', stackIndex: 0 };
    }

    const columnWidth = BLOCK_WIDTH + STACK_MARGIN;
    const stackIndex = Math.floor(relativeX / columnWidth);

    if (stackIndex < 0) {
      return { type: 'table', target: 'Table', stackIndex: 0 };
    }

    if (stackIndex >= this.world.stacks.length) {
      return { type: 'table', target: 'Table', stackIndex: this.world.stacks.length };
    }

    const targetStack = this.world.stacks[stackIndex];
    if (!Array.isArray(targetStack) || targetStack.length === 0) {
      return { type: 'table', target: 'Table', stackIndex };
    }

    return {
      type: 'stack',
      target: targetStack[targetStack.length - 1],
      stackIndex
    };
  }

  isLocked(blockName) {
    return this.lockedBlocks.has(blockName);
  }

  isBlockBeingDragged(blockName) {
    return this.dragState !== null && this.dragState.block === blockName;
  }

  isDragging() {
    return this.dragState !== null;
  }

  forceCancelDrag() {
    if (this.dragState) {
      this.cancelDrag();
    }
  }

  lockBlocks(blocks = []) {
    blocks.forEach(block => {
      if (!block) return;
      this.lockedBlocks.add(block);
      this.applyLockState(block, true);
    });
  }

  unlockBlocks(blocks = []) {
    blocks.forEach(block => {
      if (!block) return;
      this.lockedBlocks.delete(block);
      this.applyLockState(block, false);
    });
  }

  clearLockedBlocks() {
    Array.from(this.lockedBlocks).forEach(block => this.applyLockState(block, false));
    this.lockedBlocks.clear();
  }

  applyLockState(blockName, locked) {
    const elem = this.container?.querySelector(`[data-block='${blockName}']`);
    if (!elem) return;
    if (locked) {
      elem.dataset.locked = 'true';
      elem.classList.remove('cursor-grab');
      elem.classList.add('cursor-not-allowed');
    } else {
      elem.classList.remove('cursor-not-allowed');
      elem.classList.add('cursor-grab');
      if (elem.dataset.locked) {
        delete elem.dataset.locked;
      }
    }
  }
}
