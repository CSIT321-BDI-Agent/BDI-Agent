/**
 * Negotiation Protocol for Multi-Agent Conflict Resolution
 * 
 * Implements utility-based negotiation with cooperative solution finding
 */

const { computeClearBlocks } = require('../utils/blocks');

class NegotiationProtocol {
  constructor(options = {}) {
    this.utilityThreshold = options.utilityThreshold || 0.1;
    this.enableCooperative = options.enableCooperative !== false;
    this.negotiations = [];
  }

  /**
   * Main negotiation entry point
   * 
   * @param {Array<Object>} proposals - All agent proposals
   * @param {Array<Object>} conflicts - Detected conflicts
   * @param {Object} currentState - World state
   * @returns {Promise<{decisions: Array, negotiations: Array}>}
   */
  async negotiate(proposals, conflicts, currentState) {
    const negotiations = [];
    const decisions = [];

    // Process each conflict through negotiation
    for (const conflict of conflicts) {
      const negotiation = await this.negotiateConflict(
        conflict,
        currentState
      );

      negotiations.push(negotiation);
      this.negotiations.push(negotiation);
      this.applyNegotiationResult(negotiation, decisions);
    }

    // Mark non-conflicted proposals as approved
    proposals.forEach(proposal => {
      if (!decisions.find(d => d.agentId === proposal.agentId)) {
        decisions.push({
          agentId: proposal.agentId,
          move: proposal.move,
          status: 'approved',
          reason: 'no-conflict'
        });
      }
    });

    return { decisions, negotiations };
  }

  /**
   * Negotiate a specific conflict between two agents
   * 
   * @param {Object} conflict - Conflict to resolve
   * @param {Object} state - Current world state
   * @returns {Promise<Object>} Negotiation result
   */
  async negotiateConflict(conflict, state) {
    const { proposalA, proposalB, type } = conflict;

    // Calculate utilities for both proposals
    const utilityA = this.calculateUtility(proposalA, state);
    const utilityB = this.calculateUtility(proposalB, state);

    const negotiation = {
      conflictId: `${type}-${Date.now()}`,
      type,
      proposalA,
      proposalB,
      utilityA,
      utilityB,
      phases: []
    };

    // PHASE 1: Utility-based comparison
    negotiation.phases.push({
      phase: 'utility-comparison',
      utilityA,
      utilityB,
      utilityDiff: Math.abs(utilityA - utilityB)
    });

    // If utilities are significantly different, winner is clear
    if (Math.abs(utilityA - utilityB) > this.utilityThreshold) {
      negotiation.resolution = {
        type: 'utility-winner',
        winner: utilityA > utilityB ? proposalA : proposalB,
        loser: utilityA > utilityB ? proposalB : proposalA,
        reason: `Higher utility (${Math.max(utilityA, utilityB).toFixed(2)} vs ${Math.min(utilityA, utilityB).toFixed(2)})`
      };
      return negotiation;
    }

    // PHASE 2: Equal utility - try to find cooperative solution
    if (this.enableCooperative) {
      negotiation.phases.push({
        phase: 'cooperative-search'
      });

      const cooperativeSolution = await this.findCooperativeSolution(
        proposalA,
        proposalB,
        conflict,
        state
      );

      if (cooperativeSolution) {
        negotiation.resolution = cooperativeSolution;
        return negotiation;
      }
    }

    // PHASE 3: Fallback - random tiebreak for fairness
    negotiation.phases.push({
      phase: 'random-tiebreak'
    });

    const winner = Math.random() > 0.5 ? proposalA : proposalB;
    const loser = winner === proposalA ? proposalB : proposalA;

    negotiation.resolution = {
      type: 'random-tiebreak',
      winner,
      loser,
      reason: 'Equal utility, random selection'
    };

    return negotiation;
  }

  /**
   * Calculate utility of a proposal
   * 
   * Utility based on:
   * - Progress toward goal (+0.5 per relation achieved)
   * - Block clearing (+0.3 if clearing needed block)
   * - Efficiency penalty (-0.1 for unnecessary table moves)
   * 
   * @param {Object} proposal - Agent proposal
   * @param {Object} state - World state
   * @returns {number} Utility score (0-1)
   */
  calculateUtility(proposal, state) {
    const { move } = proposal;
    let utility = 0;

    if (!move) return 0;

    // Check if move directly achieves a goal relation
    if (state.goalChain) {
      for (let i = 0; i < state.goalChain.length - 1; i++) {
        if (move.block === state.goalChain[i] && 
            move.to === state.goalChain[i + 1]) {
          utility += 0.5; // Direct goal achievement
        }
      }
    }

    // Check if move clears a block that needs to be moved
    const clearBlocks = computeClearBlocks(state.stacks);
    if (clearBlocks.includes(move.block)) {
      utility += 0.3; // Clearing needed block
    }

    // Check if destination is in goal chain
    if (state.goalChain && state.goalChain.includes(move.to)) {
      utility += 0.2; // Moving toward goal structure
    }

    // Penalty for moving to table without clearing reason
    if (move.to === 'Table' && move.reason !== 'clear') {
      utility -= 0.1; // Discourage unnecessary table moves
    }

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, utility));
  }

  /**
   * Try to find a cooperative solution that allows both agents to proceed
   * 
   * @param {Object} proposalA
   * @param {Object} proposalB
   * @param {Object} conflict
   * @param {Object} state
   * @returns {Promise<Object|null>}
   */
  async findCooperativeSolution(proposalA, proposalB, conflict, state) {
    // Strategy 1: Resource conflict - suggest alternative for one agent
    if (conflict.type === 'RESOURCE_CONFLICT') {
      const altMoveA = this.findAlternativeMove(proposalA, state, conflict.resource);
      const altMoveB = this.findAlternativeMove(proposalB, state, conflict.resource);

      if (altMoveA) {
        return {
          type: 'cooperative-alternative',
          winner: proposalB, // B keeps original move
          loser: proposalA,  // A gets alternative
          alternative: altMoveA,
          reason: 'Alternative move found for Agent A'
        };
      }

      if (altMoveB) {
        return {
          type: 'cooperative-alternative',
          winner: proposalA,
          loser: proposalB,
          alternative: altMoveB,
          reason: 'Alternative move found for Agent B'
        };
      }
    }

    // Strategy 2: Ordering conflict - suggest sequential execution
    if (conflict.type === 'ORDERING_CONFLICT') {
      return {
        type: 'cooperative-sequential',
        first: proposalA,  // A goes first
        second: proposalB, // B waits and replans
        reason: 'Sequential execution resolves ordering conflict'
      };
    }

    return null;
  }

  /**
   * Find an alternative move for an agent
   * 
   * @param {Object} proposal - Original proposal
   * @param {Object} state - World state
   * @param {string} avoidBlock - Block to avoid
   * @returns {Object|null} Alternative move or null
   */
  findAlternativeMove(proposal, state, avoidBlock) {
    const clearBlocks = computeClearBlocks(state.stacks);
    const { goalChain } = state;

    if (!goalChain) return null;

    // Look for another block from agent's goal chain that is clear
    for (let i = 0; i < goalChain.length - 1; i++) {
      const block = goalChain[i];

      if (block !== avoidBlock && clearBlocks.includes(block)) {
        // Find appropriate destination
        const destination = goalChain[i + 1];
        
        return {
          block,
          to: destination,
          reason: 'alternative'
        };
      }
    }

    return null;
  }

  /**
   * Apply negotiation result to decisions list
   * 
   * @param {Object} negotiation - Completed negotiation
   * @param {Array} decisions - Decisions array to update
   */
  applyNegotiationResult(negotiation, decisions) {
    const { resolution } = negotiation;

    if (resolution.type === 'utility-winner' || resolution.type === 'random-tiebreak') {
      // Winner's move approved
      decisions.push({
        agentId: resolution.winner.agentId,
        move: resolution.winner.move,
        status: 'approved',
        reason: resolution.type,
        negotiationId: negotiation.conflictId
      });

      // Loser's move blocked
      decisions.push({
        agentId: resolution.loser.agentId,
        move: resolution.loser.move,
        status: 'blocked',
        reason: resolution.reason,
        negotiationId: negotiation.conflictId
      });

    } else if (resolution.type === 'cooperative-alternative') {
      // Winner keeps original move
      decisions.push({
        agentId: resolution.winner.agentId,
        move: resolution.winner.move,
        status: 'approved',
        reason: 'cooperative-winner',
        negotiationId: negotiation.conflictId
      });

      // Loser gets alternative move
      decisions.push({
        agentId: resolution.loser.agentId,
        move: resolution.alternative,
        status: 'approved-alternative',
        originalMove: resolution.loser.move,
        reason: resolution.reason,
        negotiationId: negotiation.conflictId
      });

    } else if (resolution.type === 'cooperative-sequential') {
      // First agent approved
      decisions.push({
        agentId: resolution.first.agentId,
        move: resolution.first.move,
        status: 'approved',
        reason: 'cooperative-first',
        negotiationId: negotiation.conflictId
      });

      // Second agent deferred (will replan next cycle)
      decisions.push({
        agentId: resolution.second.agentId,
        move: resolution.second.move,
        status: 'deferred',
        reason: 'cooperative-wait',
        negotiationId: negotiation.conflictId
      });
    }
  }

  /**
   * Get negotiation statistics
   * 
   * @returns {Object}
   */
  getStatistics() {
    const byType = {};
    const byResolution = {};

    this.negotiations.forEach(neg => {
      byType[neg.type] = (byType[neg.type] || 0) + 1;
      if (neg.resolution) {
        byResolution[neg.resolution.type] = (byResolution[neg.resolution.type] || 0) + 1;
      }
    });

    return {
      total: this.negotiations.length,
      byConflictType: byType,
      byResolutionType: byResolution,
      cooperativeSolutions: byResolution['cooperative-alternative'] || 0
    };
  }

  /**
   * Reset negotiation history
   */
  reset() {
    this.negotiations = [];
  }
}

module.exports = NegotiationProtocol;
