/**
 * Deliberation Manager for Multi-Agent Coordination
 * 
 * Orchestrates the deliberation cycle:
 * 1. Collect proposals from agents
 * 2. Detect conflicts
 * 3. Negotiate resolutions
 * 4. Broadcast decisions
 */

const EventEmitter = require('events');
const ConflictDetector = require('./ConflictDetector');
const NegotiationProtocol = require('./NegotiationProtocol');

class DeliberationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.agents = options.agents || [];
    this.enableNegotiation = options.enableNegotiation !== false;
    this.timeout = options.timeout || 5000;
    this.conflictDetector = new ConflictDetector();
    this.negotiator = new NegotiationProtocol({
      utilityThreshold: options.utilityThreshold || 0.1,
      enableCooperative: options.enableCooperative !== false
    });
    
    this.deliberationHistory = [];
  }

  /**
   * Main deliberation cycle
   * 
   * Processes all agent proposals, detects conflicts, negotiates resolutions
   * 
   * @param {Array<Object>} proposals - Proposals from all agents
   * @param {Object} currentState - Current world state
  * @returns {{decisions: Array, conflicts: Array, negotiations: Array}}
   */
  deliberate(proposals, currentState) {
    const deliberationId = `delib-${Date.now()}`;
    const startTime = Date.now();
    
    this.emit('deliberation:start', {
      id: deliberationId,
      proposals,
      cycle: currentState.cycle || 0
    });

    try {
      // Phase 1: Validate proposals
      const validProposals = this.validateProposals(proposals, currentState);
      
      if (validProposals.length === 0) {
        // No valid proposals - agents may be done
        return {
          decisions: [],
          conflicts: [],
          negotiations: [],
          valid: false
        };
      }

      // Phase 2: Detect conflicts
      const conflicts = this.conflictDetector.detectAll(validProposals, currentState);
      
      this.emit('deliberation:conflicts', {
        id: deliberationId,
        conflicts,
        count: conflicts.length
      });

      // Phase 3: Negotiate resolutions (if conflicts exist and negotiation enabled)
      let decisions;
      let negotiations = [];

      if (conflicts.length > 0 && this.enableNegotiation) {
        const negotiationResult = this.negotiateWithTimeout(
          validProposals,
          conflicts,
          currentState
        );
        
        decisions = negotiationResult.decisions;
        negotiations = negotiationResult.negotiations;

      } else if (conflicts.length > 0) {
        // No negotiation - use simple priority resolution
        const resolutionResult = this.resolveByPriority(validProposals, conflicts);
        decisions = resolutionResult.decisions;

      } else {
        // No conflicts - approve all proposals
        decisions = validProposals.map(p => ({
          agentId: p.agentId,
          move: p.move,
          status: 'approved',
          reason: 'no-conflict'
        }));
      }

      const elapsedMs = Date.now() - startTime;

      const result = {
        id: deliberationId,
        decisions,
        conflicts,
        negotiations,
        elapsedMs,
        valid: true
      };

      this.deliberationHistory.push(result);

      this.emit('deliberation:resolved', result);

      return result;

    } catch (error) {
      this.emit('deliberation:error', { error, deliberationId });
      
      // Fallback: approve first proposal only
      return {
        decisions: proposals.slice(0, 1).map(p => ({
          agentId: p.agentId,
          move: p.move,
          status: 'approved',
          reason: 'error-fallback'
        })),
        conflicts: [],
        negotiations: [],
        error: error.message
      };
    }
  }

  /**
   * Validate that proposals are legal moves
   * 
   * @param {Array<Object>} proposals
   * @param {Object} currentState
  * @returns {Array} Valid proposals
   */
  validateProposals(proposals, currentState) {
    return proposals.filter(proposal => {
      if (!proposal.move) return false;

      const { block, to } = proposal.move;
      
      // Basic validation - block must be clear and destination valid
      return this.isValidMove(block, to, currentState.stacks);
    });
  }

  /**
   * Check if a move is valid in current state
   * 
   * @param {string} block
   * @param {string} to
   * @param {Array} stacks
   * @returns {boolean}
   */
  isValidMove(block, to, stacks) {
    // Block must exist and be clear (on top of a stack)
    let blockIsClear = false;
    
    for (const stack of stacks) {
      if (stack.length > 0 && stack[stack.length - 1] === block) {
        blockIsClear = true;
        break;
      }
    }

    if (!blockIsClear) return false;

    // Destination must be 'Table' or a clear block
    if (to === 'Table') return true;

    // Check if destination block exists and is clear
    for (const stack of stacks) {
      if (stack.length > 0 && stack[stack.length - 1] === to) {
        return true;
      }
    }

    return false;
  }

  /**
   * Run negotiation with timeout protection
   * 
   * @param {Array} proposals
   * @param {Array} conflicts
   * @param {Object} currentState
  * @returns {Object}
   */
  negotiateWithTimeout(proposals, conflicts, currentState) {
    const result = this.negotiator.negotiate(proposals, conflicts, currentState);

    if (!result || typeof result !== 'object') {
      throw new Error('Negotiation protocol returned invalid result');
    }

    return result;
  }

  /**
   * Simple priority-based resolution (fallback when no negotiation)
   * 
   * @param {Array} proposals
   * @param {Array} conflicts
   * @returns {Object}
   */
  resolveByPriority(proposals, conflicts) {
    // Simple: First proposal wins conflicts
    const decisions = proposals.map((p, idx) => ({
      agentId: p.agentId,
      move: p.move,
      status: idx === 0 ? 'approved' : 'blocked',
      reason: idx === 0 ? 'priority-first' : 'priority-blocked'
    }));

    return { decisions, negotiations: [] };
  }

  /**
   * Get statistics about deliberations
   * 
   * @returns {Object}
   */
  getStatistics() {
    const avgElapsed = this.deliberationHistory.reduce((sum, d) => sum + (d.elapsedMs || 0), 0) 
                      / (this.deliberationHistory.length || 1);

    const totalConflicts = this.deliberationHistory.reduce((sum, d) => sum + d.conflicts.length, 0);
    const totalNegotiations = this.deliberationHistory.reduce((sum, d) => sum + d.negotiations.length, 0);

    return {
      totalDeliberations: this.deliberationHistory.length,
      averageElapsedMs: avgElapsed.toFixed(2),
      totalConflicts,
      totalNegotiations,
      conflictStats: this.conflictDetector.getStatistics(),
      negotiationStats: this.negotiator.getStatistics()
    };
  }

  /**
   * Reset all state
   */
  reset() {
    this.deliberationHistory = [];
    this.conflictDetector.reset();
    this.negotiator.reset();
  }
}

module.exports = DeliberationManager;
