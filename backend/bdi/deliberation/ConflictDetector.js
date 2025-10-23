/**
 * Conflict Detection for Multi-Agent BDI Planning
 * 
 * Detects all types of conflicts between agent proposals:
 * 1. Resource Conflict - Both agents want same block
 * 2. Destination Conflict - Both agents want to stack on same target
 * 3. Ordering Conflict - One agent clears what another needs
 * 4. Goal Conflict - Both working on same goal relation
 */

class ConflictDetector {
  constructor() {
    this.conflictHistory = [];
  }

  /**
   * Detects all conflicts between multiple agent proposals
   * 
   * @param {Array<{agentId: string, move: {block: string, to: string}, timestamp: number}>} proposals
   * @param {Object} currentState - World state with stacks, goalChain
   * @returns {Array<Object>} List of detected conflicts
   */
  detectAll(proposals, currentState) {
    const conflicts = [];

    // Only check if multiple proposals exist
    if (proposals.length < 2) return conflicts;

    // Pairwise conflict detection
    for (let i = 0; i < proposals.length; i++) {
      for (let j = i + 1; j < proposals.length; j++) {
        const conflict = this.detectPairwiseConflict(
          proposals[i],
          proposals[j],
          currentState
        );

        if (conflict) {
          conflicts.push(conflict);
          this.conflictHistory.push({
            ...conflict,
            timestamp: Date.now(),
            cycle: currentState.cycle || 0
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detects conflict between two specific proposals
   * 
   * @param {Object} proposalA - First agent's proposal
   * @param {Object} proposalB - Second agent's proposal
   * @param {Object} state - Current world state
   * @returns {Object|null} Conflict object or null if no conflict
   */
  detectPairwiseConflict(proposalA, proposalB, state) {
    const moveA = proposalA.move;
    const moveB = proposalB.move;

    if (!moveA || !moveB) return null;

    // TYPE 1: RESOURCE CONFLICT
    // Both agents want to move the same block
    if (moveA.block === moveB.block) {
      return {
        type: 'RESOURCE_CONFLICT',
        resource: moveA.block,
        proposalA,
        proposalB,
        description: `Both agents want to move block ${moveA.block}`,
        severity: 'HIGH'
      };
    }

    // TYPE 2: DESTINATION CONFLICT
    // Both agents want to stack on the same target block (not Table)
    if (moveA.to === moveB.to && moveA.to !== 'Table') {
      return {
        type: 'DESTINATION_CONFLICT',
        destination: moveA.to,
        proposalA,
        proposalB,
        description: `Both agents want to stack on block ${moveA.to}`,
        severity: 'HIGH'
      };
    }

    // TYPE 3: ORDERING CONFLICT
    // Agent A clears a block that Agent B wants to use as destination
    // Or vice versa
    if (moveA.block === moveB.to || moveB.block === moveA.to) {
      return {
        type: 'ORDERING_CONFLICT',
        blocks: [moveA.block, moveB.block, moveA.to, moveB.to],
        proposalA,
        proposalB,
        description: `Agent ${proposalA.agentId} clears block that ${proposalB.agentId} needs`,
        severity: 'MEDIUM'
      };
    }

    // TYPE 4: GOAL CONFLICT
    // Both agents working on the same goal relation
    const goalConflict = this.detectGoalConflict(moveA, moveB, state);
    if (goalConflict) {
      return {
        ...goalConflict,
        proposalA,
        proposalB
      };
    }

    return null;
  }

  /**
   * Detects if both moves target the same goal relation
   * 
   * @param {Object} moveA - First move {block, to}
   * @param {Object} moveB - Second move {block, to}
   * @param {Object} state - Current state with goalChain
   * @returns {Object|null} Goal conflict or null
   */
  detectGoalConflict(moveA, moveB, state) {
    if (!state.goalChain) return null;

    const { goalChain } = state;
    
    // Check if moves target the same goal relation
    for (let i = 0; i < goalChain.length - 1; i++) {
      const relation = {
        block: goalChain[i],
        to: goalChain[i + 1]
      };

      const aTargetsRelation = (moveA.block === relation.block || moveA.to === relation.to);
      const bTargetsRelation = (moveB.block === relation.block || moveB.to === relation.to);

      if (aTargetsRelation && bTargetsRelation) {
        return {
          type: 'GOAL_CONFLICT',
          goalRelation: relation,
          description: `Both agents working on goal relation (${relation.block} on ${relation.to})`,
          severity: 'MEDIUM'
        };
      }
    }
    
    return null;
  }

  /**
   * Gets conflict statistics
   * 
   * @returns {Object} Stats about conflicts detected
   */
  getStatistics() {
    const byType = {};
    
    this.conflictHistory.forEach(conflict => {
      const type = conflict.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: this.conflictHistory.length,
      byType,
      history: this.conflictHistory
    };
  }

  /**
   * Clears conflict history
   */
  reset() {
    this.conflictHistory = [];
  }
}

module.exports = ConflictDetector;
