import { BLOCK_WIDTH, BLOCK_HEIGHT, STACK_MARGIN, WORLD_HEIGHT } from './constants.js';
import { showMessage } from './helpers.js';

const DRAGGING_CLASSES = ['ring-2', 'ring-brand-primary/60', 'shadow-xl', 'cursor-grabbing'];

export class BlockDragManager {
  constructor(world, container) {
    this.world = world;
    this.container = container;
    this.enabled = false;
    this.dragState = null;
    this.onUserMutation = null;

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
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.attachListeners();
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

    if (!this.world.isClear(blockName)) {
      showMessage(`Block "${blockName}" is not clear. Move blocks above it first.`, 'warning');
      return;
    }

    const rect = blockElem.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    this.dragState = {
      block: blockName,
      element: blockElem,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalTransition: blockElem.style.transition,
      originalLeft: blockElem.style.left,
      originalTop: blockElem.style.top,
      originSupport: this.world.on[blockName] || 'Table'
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
    const { block, element, originalTransition, originSupport } = this.dragState;
    element.releasePointerCapture(this.dragState.pointerId);

    element.style.transition = originalTransition || '';
    DRAGGING_CLASSES.forEach(cls => element.classList.remove(cls));

    const destination = this.resolveDropTarget(event);
    this.resetDragState();

    if (!destination) {
      this.world.updatePositions();
      return;
    }

    const { type, target } = destination;
    const normalizedDest = type === 'table' ? 'Table' : target;

    if (!this.isMoveMeaningful(block, normalizedDest, originSupport)) {
      this.world.updatePositions();
      return;
    }

    if (!this.isDestinationValid(block, normalizedDest)) {
      showMessage(`Cannot move ${block} onto ${normalizedDest}.`, 'warning');
      this.world.updatePositions();
      return;
    }

    try {
      this.world.moveBlock(block, normalizedDest);
      this.world.updatePositions();
      if (typeof this.onUserMutation === 'function') {
        this.onUserMutation({
          type: 'MOVE',
          block,
          to: normalizedDest,
          from: originSupport
        });
      }
    } catch (error) {
      console.error('BlockDragManager: failed to apply move', error);
      showMessage('Unable to complete that move.', 'error');
      this.world.updatePositions();
    }
  }

  cancelDrag() {
    const { element, originalTransition } = this.dragState || {};
    if (element) {
      element.releasePointerCapture?.(this.dragState.pointerId);
      element.style.transition = originalTransition || '';
      DRAGGING_CLASSES.forEach(cls => element.classList.remove(cls));
    }
    this.resetDragState();
    this.world?.updatePositions();
  }

  resetDragState() {
    this.dragState = null;
  }

  isMoveMeaningful(block, destination, originSupport) {
    if (destination === 'Table' && originSupport === 'Table') {
      return false;
    }
    if (destination === originSupport) {
      return false;
    }
    return true;
  }

  isDestinationValid(block, destination) {
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
    return this.world.isClear(destination);
  }

  resolveDropTarget(event) {
    if (!this.container) return null;

    const containerRect = this.container.getBoundingClientRect();
    const relativeX = event.clientX - containerRect.left;

    if (relativeX < 0 || this.world.stacks.length === 0) {
      return { type: 'table', target: 'Table' };
    }

    const columnWidth = BLOCK_WIDTH + STACK_MARGIN;
    const stackIndex = Math.floor(relativeX / columnWidth);

    if (stackIndex < 0 || stackIndex >= this.world.stacks.length) {
      return { type: 'table', target: 'Table' };
    }

    const targetStack = this.world.stacks[stackIndex];
    if (!Array.isArray(targetStack) || targetStack.length === 0) {
      return { type: 'table', target: 'Table' };
    }

    return {
      type: 'stack',
      target: targetStack[targetStack.length - 1]
    };
  }
}
