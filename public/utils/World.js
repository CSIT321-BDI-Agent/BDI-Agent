/**
 * World Class - Manages block world state and visualization
 * 
 * This class handles all block operations including:
 * - Adding and removing blocks
 * - Moving blocks between stacks
 * - Updating DOM positions
 * - Managing block relationships
 */

import { randomColour, showMessage } from './helpers.js';
import { BLOCK_WIDTH, BLOCK_HEIGHT, WORLD_HEIGHT, STACK_MARGIN } from './constants.js';

export class World {
  constructor(container) {
    this.container = container;
    this.stacks = [];
    this.on = {};
    this.blocks = [];
    this.colours = {};
  }

  /**
   * Add a new block to the world
   * @param {string} name - Single letter block name
   */
  addBlock(name) {
    name = name.trim().toUpperCase();
    if (!name) return false;
    
    // Check block limit
    const maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
    if (this.blocks.length >= maxBlocks) {
      this.setMessage(`Maximum ${maxBlocks} blocks allowed.`, 'warning');
      return false;
    }
    
    if (this.blocks.includes(name)) {
      this.setMessage(`Block "${name}" already exists.`, 'warning');
      return false;
    }
    
    this.blocks.push(name);
    this.stacks.push([name]);
    this.on[name] = 'Table';
    this.colours[name] = randomColour();

    const div = document.createElement('div');
    div.className = 'block';
    div.dataset.block = name;
    div.textContent = name;
    div.style.backgroundColor = this.colours[name];
    
    if (this.container) {
      this.container.appendChild(div);
      this.updatePositions();
    }
    
    this.notifyBlocksChanged();
    this.setMessage('');
    return true;
  }

  /**
   * Remove a block from the world (must be clear)
   * @param {string} name - Block name to remove
   * @returns {boolean} Whether the block was removed
   */
  removeBlock(name) {
    const blockName = (name || '').trim().toUpperCase();
    if (!blockName || !this.blocks.includes(blockName)) {
      this.setMessage(`Block "${blockName || '?'}" does not exist.`, 'warning');
      return false;
    }

    if (!this.isClear(blockName)) {
      this.setMessage(`Block "${blockName}" is not clear. Remove blocks on top first.`, 'warning');
      return false;
    }

    const stackIndex = this.stacks.findIndex(s => s.includes(blockName));
    if (stackIndex === -1) {
      this.setMessage(`Could not locate block "${blockName}" in stacks.`, 'error');
      return false;
    }

    const stack = this.stacks[stackIndex];
    stack.pop();
    if (stack.length === 0) {
      this.stacks.splice(stackIndex, 1);
    }

    this.blocks = this.blocks.filter(b => b !== blockName);
    delete this.on[blockName];
    delete this.colours[blockName];

    const div = this.container?.querySelector(`[data-block='${blockName}']`);
    if (div) {
      div.remove();
    }

    this.updatePositions();
    this.notifyBlocksChanged();
    this.setMessage('');
    return true;
  }

  /**
   * Move a block to a new destination
   * @param {string} block - Block to move
   * @param {string} dest - Destination (block name or 'Table')
   */
  moveBlock(block, dest) {
    const fromIndex = this.stacks.findIndex(s => s.includes(block));
    if (fromIndex === -1) throw new Error(`Block ${block} is not in any stack`);
    const stack = this.stacks[fromIndex];
    const removed = stack.pop();
    if (removed !== block) throw new Error(`Attempted to move non-top block ${block}.`);
    if (stack.length === 0) this.stacks.splice(fromIndex, 1);

    if (dest === 'Table') {
      this.stacks.push([block]);
      this.on[block] = 'Table';
    } else {
      const destIndex = this.stacks.findIndex(s => s.includes(dest));
      if (destIndex === -1) throw new Error(`Destination block ${dest} not found`);
      this.stacks[destIndex].push(block);
      this.on[block] = dest;
    }
  }

  /**
   * Dispatch a DOM event when block composition changes
   */
  notifyBlocksChanged() {
    const detail = {
      count: this.blocks.length,
      blocks: this.getCurrentBlocks()
    };

    document.dispatchEvent(new CustomEvent('world:blocks-changed', { detail }));
  }

  /**
   * Get the block directly above the specified block
   * @param {string} block - Block name
   * @returns {string|null} Block above or null
   */
  getAbove(block) {
    for (const b of this.blocks) {
      if (this.on[b] === block) return b;
    }
    return null;
  }

  /**
   * Check if a block has no blocks on top of it
   * @param {string} block - Block name
   * @returns {boolean} True if clear
   */
  isClear(block) {
    return !this.blocks.some(b => this.on[b] === block);
  }

  /**
   * Update DOM positions for all blocks
   * @param {string} skipBlock - Block to skip (currently being animated)
   */
  updatePositions(skipBlock) {
    const width = this.stacks.length * (BLOCK_WIDTH + STACK_MARGIN);
    this.container.style.width = `${width}px`;
    this.stacks.forEach((stack, index) => {
      stack.forEach((blockName, posIdx) => {
        if (blockName === skipBlock) return;
        const div = this.container.querySelector(`[data-block='${blockName}']`);
        if (!div) return;
        const left = index * (BLOCK_WIDTH + STACK_MARGIN);
        const top = WORLD_HEIGHT - (posIdx + 1) * BLOCK_HEIGHT;
        div.style.left = `${left}px`;
        div.style.top = `${top}px`;
      });
    });
  }

  /**
   * Display a message to the user
   * @param {string} msg - Message text
   */
  setMessage(msg, type = 'info') {
    if (!msg) {
      const messagesElem = document.getElementById('messages');
      if (messagesElem) {
        messagesElem.textContent = '';
        messagesElem.className = 'messages';
      }
      return;
    }

    showMessage(msg, type);
  }

  /**
   * Get current blocks list
   * @returns {Array} Copy of blocks array
   */
  getCurrentBlocks() {
    return [...this.blocks];
  }

  /**
   * Get current stacks configuration
   * @returns {Array} Deep copy of stacks array
   */
  getCurrentStacks() {
    return this.stacks.map(s => [...s]);
  }
}
