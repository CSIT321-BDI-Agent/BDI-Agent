/**
 * Collaborative Multi-Agent Orchestrator
 * 
 * Both agents work on the same goal, proposing one step at a time.
 * They deliberate together on which block to move next.
 * If there's overlap (both want same block), they negotiate.
 */

const { getSingleAgentProposal } = require('./singleAgentProposal');
const createBlocksHelpers = require('./utils/blocks');

class PlanningError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PlanningError';
    this.status = status;
  }
}

const {
  deepCloneStacks,
  goalAchieved,
  applyMove,
  deriveOnMap,
  isBlockClear,
  selectNextRelation,
  listPendingRelations,
  topMostAbove,
  blockExists
} = createBlocksHelpers(PlanningError);

const MOVE_REASONS = {
  CLEAR_BLOCK: 'clear-block',
  CLEAR_TARGET: 'clear-target',
  STACK: 'stack'
};

const MOVE_REASON_PRIORITY = {
  [MOVE_REASONS.STACK]: 3,
  [MOVE_REASONS.CLEAR_TARGET]: 2,
  [MOVE_REASONS.CLEAR_BLOCK]: 1
};

/**
 * Expands a logical move into 4 claw animation steps
 */
function expandMoveToClawSteps(block, to) {
  return [
    {
      type: 'MOVE_CLAW',
      to: block,
      description: `Move claw to ${block}`
    },
    {
      type: 'PICK_UP',
      block: block,
      description: `Pick up ${block}`
    },
    {
      type: 'MOVE_CLAW',
      to: to,
      carrying: block,
      description: `Move ${block} to ${to}`
    },
    {
      type: 'DROP',
      block: block,
      at: to,
      description: `Drop ${block} on ${to}`
    }
  ];
}

function getReasonPriority(reason) {
  return MOVE_REASON_PRIORITY[reason] || 0;
}

function buildRelationTasks(stacks, relation) {
  if (!relation || typeof relation !== 'object') {
    return [];
  }

  const { block, destination } = relation;
  if (!blockExists(stacks, block)) {
    return [];
  }

  const tasks = [];
  const blockIsClear = isBlockClear(stacks, block);
  const destinationIsTable = destination === 'Table';
  const destinationExists = destinationIsTable || blockExists(stacks, destination);

  if (!blockIsClear) {
    const blocker = topMostAbove(stacks, block);
    if (blocker) {
      tasks.push({
        block: blocker,
        to: 'Table',
        reason: MOVE_REASONS.CLEAR_BLOCK,
        relation,
        priority: getReasonPriority(MOVE_REASONS.CLEAR_BLOCK)
      });
    }
  }

  if (destinationExists && !destinationIsTable) {
    const destinationIsClear = isBlockClear(stacks, destination);
    if (!destinationIsClear) {
      const blocker = topMostAbove(stacks, destination);
      if (blocker) {
        tasks.push({
          block: blocker,
          to: 'Table',
          reason: MOVE_REASONS.CLEAR_TARGET,
          relation,
          priority: getReasonPriority(MOVE_REASONS.CLEAR_TARGET)
        });
      }
    }
  }

  if (blockIsClear && (destinationIsTable || (destinationExists && isBlockClear(stacks, destination)))) {
    const onMap = deriveOnMap(stacks);
    if (onMap[block] !== destination) {
      tasks.push({
        block,
        to: destination,
        reason: MOVE_REASONS.STACK,
        relation,
        priority: getReasonPriority(MOVE_REASONS.STACK)
      });
    }
  }

  return tasks.sort((a, b) => b.priority - a.priority);
}

function selectCooperativeAssignments(stacks, pendingRelations) {
  if (!Array.isArray(pendingRelations) || pendingRelations.length === 0) {
    return { primary: null, secondary: null, relationEntries: [] };
  }

  const relationEntries = pendingRelations.map((relation) => ({
    relation,
    tasks: buildRelationTasks(stacks, relation)
  }));

  let primaryEntry = relationEntries.find((entry) => entry.tasks.length > 0) || null;
  if (!primaryEntry) {
    return { primary: null, secondary: null, relationEntries };
  }

  const primaryTask = { ...primaryEntry.tasks[0] };
  let secondaryTask = null;

  // Prefer a non-conflicting task from the same relation
  for (let idx = 1; idx < primaryEntry.tasks.length; idx += 1) {
    const candidate = primaryEntry.tasks[idx];
    if (!detectConflict(primaryTask, candidate)) {
      secondaryTask = { ...candidate };
      break;
    }
  }

  // Otherwise look at subsequent relations
  if (!secondaryTask) {
    for (const entry of relationEntries) {
      if (entry === primaryEntry || entry.tasks.length === 0) {
        continue;
      }
      const candidate = entry.tasks.find((task) => !detectConflict(primaryTask, task));
      if (candidate) {
        secondaryTask = { ...candidate };
        break;
      }
    }
  }

  return {
    primary: primaryTask,
    secondary: secondaryTask,
    relationEntries
  };
}

function summarizeProposal(proposal) {
  if (!proposal) {
    return 'none';
  }
  const parts = [proposal.block, '→', proposal.to];
  if (proposal.reason) {
    parts.push(`(${proposal.reason})`);
  }
  return parts.join(' ');
}

/**
 * Collaborative multi-agent planner
 * Both agents propose moves, deliberate which to execute
 * 
 * @param {Array} initialStacks - Starting world state
 * @param {Array} goalChain - Full goal chain (both agents work on this)
 * @param {Object} options - Planning options
 * @returns {Object} Planning result with moves and timeline
 */
async function collaborativePlan(initialStacks, goalChain, options = {}) {
  const {
    maxIterations = 2500,
    enableNegotiation = true,
    negotiationTimeout = 5000
  } = options;

  console.log('\n=== COLLABORATIVE MULTI-AGENT PLANNING START ===');
  console.log('Both agents working on full goal:', goalChain.join(' → '));
  console.log('Initial stacks:', JSON.stringify(initialStacks));

  let currentStacks = deepCloneStacks(initialStacks);
  const moveGroups = [];
  const intentionLog = [];
  let cycle = 0;
  const agentMoveCounts = {
    'Agent-A': 0,
    'Agent-B': 0
  };
  let lastChosenAgent = null;
  let totalConflicts = 0;
  let totalNegotiations = 0;
  let totalDeliberations = 0;
  let totalParallelExecutions = 0;

  const buildBeliefSnapshot = (stacks) => {
    const onMap = deriveOnMap(stacks);
    const clearBlocks = Object.keys(onMap).filter(block => isBlockClear(stacks, block));
    const pendingRelation = selectNextRelation(stacks, goalChain);
    return {
      pendingRelation: pendingRelation
        ? { block: pendingRelation.block, destination: pendingRelation.destination }
        : null,
      clearBlocks,
      onMap
    };
  };

  // Main collaborative planning loop
  while (!goalAchieved(currentStacks, goalChain) && cycle < maxIterations) {
    cycle++;

    // Progress tracking
    if (cycle % 100 === 0) {
      console.log(`[COLLAB] Cycle ${cycle}/${maxIterations} - Still planning...`);
      console.log(`[COLLAB] Current stacks:`, JSON.stringify(currentStacks));
    }

    // Step 1: Both agents propose their next single move
    console.log(`\n[COLLAB] Cycle ${cycle}: Both agents proposing moves...`);
    
    const pendingRelations = listPendingRelations(currentStacks, goalChain);
    const cooperativeChoice = selectCooperativeAssignments(currentStacks, pendingRelations);

    let proposalA = cooperativeChoice.primary
      ? {
          block: cooperativeChoice.primary.block,
          to: cooperativeChoice.primary.to,
          reason: cooperativeChoice.primary.reason,
          relation: cooperativeChoice.primary.relation || null
        }
      : null;

    let proposalB = cooperativeChoice.secondary
      ? {
          block: cooperativeChoice.secondary.block,
          to: cooperativeChoice.secondary.to,
          reason: cooperativeChoice.secondary.reason,
          relation: cooperativeChoice.secondary.relation || null
        }
      : null;

    const cooperativeParallel = Boolean(proposalA && proposalB);

    if (!proposalA) {
      proposalA = getSingleAgentProposal('Agent-A', currentStacks, goalChain);
    }

    if (!proposalB) {
      let optionsForB = undefined;
      if (proposalA && proposalA.reason === MOVE_REASONS.CLEAR_BLOCK) {
        optionsForB = { preferredReason: MOVE_REASONS.CLEAR_TARGET };
      }
      proposalB = getSingleAgentProposal('Agent-B', currentStacks, goalChain, optionsForB);
    }

    console.log(`[COLLAB] Agent A proposes:`, summarizeProposal(proposalA));
    console.log(`[COLLAB] Agent B proposes:`, summarizeProposal(proposalB));

    // If neither agent has a proposal, we're done or stuck
    if (!proposalA && !proposalB) {
      console.log(`[COLLAB] ✓ No proposals - goal should be achieved`);
      break;
    }

    const executedMoves = [];
    let deliberationResult = {
      conflict: false,
      chosenAgents: [],
      reason: 'no-conflict'
    };

    if (proposalA && proposalB) {
      totalDeliberations += 1;
      console.log(`[COLLAB] Both agents have proposals - deliberating...`);

      const conflictType = detectConflict(proposalA, proposalB);

      if (!conflictType) {
        if (cooperativeParallel) {
          console.log('[COLLAB] Cooperative selection produced non-conflicting proposals – executing both in parallel.');
        } else {
          console.log('[COLLAB] No conflict detected – executing both proposals in parallel.');
        }
        executedMoves.push({ agent: 'Agent-A', proposal: proposalA });
        executedMoves.push({ agent: 'Agent-B', proposal: proposalB });
        deliberationResult = {
          conflict: false,
          chosenAgents: ['Agent-A', 'Agent-B'],
          reason: cooperativeParallel ? 'cooperative-parallel' : 'non-conflicting'
        };
      } else {
        totalConflicts += 1;
        console.log(`[COLLAB] ⚠️ CONFLICT (${conflictType}):`);
        console.log(`[COLLAB]   Agent A: ${proposalA.block} → ${proposalA.to} (${proposalA.reason})`);
        console.log(`[COLLAB]   Agent B: ${proposalB.block} → ${proposalB.to} (${proposalB.reason})`);

        const priorityA = getMovePriority(proposalA);
        const priorityB = getMovePriority(proposalB);
        const deliberationChoice = resolvePriorityConflict({
          priorityA,
          priorityB,
          agentMoveCounts,
          lastChosenAgent
        });

        const winningAgent = deliberationChoice;
        const winningProposal = winningAgent === 'Agent-A' ? proposalA : proposalB;
        const losingAgent = winningAgent === 'Agent-A' ? 'Agent-B' : 'Agent-A';

        deliberationResult = {
          conflict: true,
          conflictType,
          chosenAgents: [winningAgent],
          reason: buildPriorityReason(winningAgent, priorityA, priorityB, agentMoveCounts)
        };

        console.log(`[COLLAB] 🤝 ${winningAgent} wins negotiation (${deliberationResult.reason}). ${losingAgent} defers.`);

        executedMoves.push({ agent: winningAgent, proposal: winningProposal });

        if (enableNegotiation) {
          totalNegotiations += 1;
        }
      }
    } else if (proposalA) {
      executedMoves.push({ agent: 'Agent-A', proposal: proposalA });
      deliberationResult = {
        conflict: false,
        chosenAgents: ['Agent-A'],
        reason: 'single-proposal'
      };
      console.log('[COLLAB] Only Agent A has a proposal - executing it.');
    } else if (proposalB) {
      executedMoves.push({ agent: 'Agent-B', proposal: proposalB });
      deliberationResult = {
        conflict: false,
        chosenAgents: ['Agent-B'],
        reason: 'single-proposal'
      };
      console.log('[COLLAB] Only Agent B has a proposal - executing it.');
    }

    if (!executedMoves.length) {
      console.log('[COLLAB] ⚠️ No executable moves selected this cycle. Stopping planner loop.');
      break;
    }

    executedMoves.forEach(({ agent, proposal }) => {
      console.log(`[COLLAB] ✓ Executing (${agent}): ${proposal.block} → ${proposal.to} (${proposal.reason})`);
      agentMoveCounts[agent] += 1;
    });

    if (executedMoves.length > 1) {
      totalParallelExecutions += 1;
    }

    const nextStacks = deepCloneStacks(currentStacks);
    executedMoves.forEach(({ proposal }) => {
      applyMove(nextStacks, proposal.block, proposal.to);
    });
    currentStacks = nextStacks;

    lastChosenAgent = executedMoves[executedMoves.length - 1]?.agent ?? lastChosenAgent;

    executedMoves.forEach((exec) => {
      exec.clawSteps = expandMoveToClawSteps(exec.proposal.block, exec.proposal.to);
    });

    const beliefsSnapshot = buildBeliefSnapshot(currentStacks);
    const goalStatus = goalAchieved(currentStacks, goalChain);

    const timelineEntries = buildTimelineEntries({
      executedMoves,
      currentStacks,
      beliefsSnapshot,
      intentionLog,
      proposals: { agentA: proposalA, agentB: proposalB },
      deliberationResult,
      goalAchievedFlag: goalStatus
    });

    timelineEntries.forEach(entry => intentionLog.push(entry));

    moveGroups.push(buildMoveGroup(cycle, executedMoves, deliberationResult));

    console.log(`[COLLAB] New stacks:`, JSON.stringify(currentStacks));
  }

  // Final result
  const finalGoalAchieved = goalAchieved(currentStacks, goalChain);
  
  console.log('\n=== COLLABORATIVE PLANNING COMPLETE ===');
  console.log('Cycles used:', cycle);
  const totalExecutedMoves = agentMoveCounts['Agent-A'] + agentMoveCounts['Agent-B'];
  console.log('Moves generated:', totalExecutedMoves, 'logical moves across', moveGroups.length, 'cycles');
  console.log('Goal achieved:', finalGoalAchieved);
  console.log('Final stacks:', JSON.stringify(currentStacks));

  if (!finalGoalAchieved && cycle >= maxIterations) {
    console.log('\n⚠️ REACHED ITERATION LIMIT');
    console.log('Goal:', goalChain.join(' → '));
    console.log('Current state:', JSON.stringify(currentStacks));
  }

  return {
    moves: moveGroups,
    iterations: cycle,
    goalAchieved: finalGoalAchieved,
    intentionLog,
    finalStacks: currentStacks,
    planningApproach: 'collaborative-single-step',
    agentCount: 2,
    statistics: {
      agentAMoves: agentMoveCounts['Agent-A'],
      agentBMoves: agentMoveCounts['Agent-B'],
      totalConflicts,
      totalNegotiations,
      totalDeliberations,
      totalParallelExecutions
    }
  };
}

/**
 * Priority heuristic for move selection
 * Higher priority = more important move
 */
function getMovePriority(proposal) {
  if (!proposal) return 0;
  
  // Stack moves (achieving goal relations) are highest priority
  if (proposal.reason === 'stack') return 3;
  
  // Clearing target location is higher priority than clearing source
  if (proposal.reason === 'clear-target') return 2;
  
  // Clearing block is lowest priority
  if (proposal.reason === 'clear-block') return 1;
  
  return 0;
}

function resolvePriorityConflict({ priorityA, priorityB, agentMoveCounts, lastChosenAgent }) {
  if (priorityA > priorityB) {
    return 'Agent-A';
  }
  if (priorityB > priorityA) {
    return 'Agent-B';
  }

  const movesA = agentMoveCounts['Agent-A'] ?? 0;
  const movesB = agentMoveCounts['Agent-B'] ?? 0;

  if (movesA < movesB) {
    return 'Agent-A';
  }
  if (movesB < movesA) {
    return 'Agent-B';
  }

  return lastChosenAgent === 'Agent-A' ? 'Agent-B' : 'Agent-A';
}

function buildPriorityReason(agent, priorityA, priorityB, agentMoveCounts) {
  if (priorityA !== priorityB) {
    const winnerPriority = agent === 'Agent-A' ? priorityA : priorityB;
    const loserPriority = agent === 'Agent-A' ? priorityB : priorityA;
    const comparator = winnerPriority > loserPriority ? '>' : '<';
    return `priority-${winnerPriority} ${comparator} ${loserPriority}`;
  }

  const movesA = agentMoveCounts['Agent-A'] ?? 0;
  const movesB = agentMoveCounts['Agent-B'] ?? 0;

  if (movesA !== movesB) {
    return `workload-balance (${movesA}:${movesB})`;
  }

  return 'alternating-tie-break';
}

function detectConflict(moveA, moveB) {
  if (!moveA || !moveB) {
    return null;
  }

  if (moveA.block === moveB.block) {
    return 'resource';
  }

  if (moveA.to === moveB.to && moveA.to !== 'Table') {
    return 'destination';
  }

  if (moveA.block === moveB.to || moveB.block === moveA.to) {
    return 'dependency';
  }

  return null;
}

function buildMoveGroup(cycleNumber, executedMoves, deliberationResult) {
  return {
    cycle: cycleNumber,
    moves: executedMoves.map(({ agent, proposal, clawSteps }) => ({
      block: proposal.block,
      to: proposal.to,
      reason: proposal.reason,
      actor: agent,
      planner: 'collaborative-single-step',
      clawSteps
    })),
    deliberation: deliberationResult
  };
}

function buildTimelineEntries({
  executedMoves,
  currentStacks,
  beliefsSnapshot,
  intentionLog,
  proposals,
  deliberationResult,
  goalAchievedFlag
}) {
  if (!Array.isArray(executedMoves) || executedMoves.length === 0) {
    return [];
  }

  const totalSteps = executedMoves.reduce((max, exec) => {
    const stepCount = Array.isArray(exec.clawSteps) ? exec.clawSteps.length : 0;
    return Math.max(max, stepCount);
  }, 0);

  if (totalSteps === 0) {
    return [];
  }

  const entries = [];

  for (let stepIdx = 0; stepIdx < totalSteps; stepIdx += 1) {
    const stepMoves = executedMoves.map((exec) => {
      const step = exec.clawSteps[stepIdx] || {};
      const stepType = step.type || '';
      return {
        actor: exec.agent,
        block: step.block || exec.proposal.block,
        to: step.to || (stepType === 'PICK_UP' ? 'claw' : exec.proposal.to),
        reason: (stepType || exec.proposal.reason || '').toLowerCase().replace(/[_\s]+/g, '-'),
        stepType,
        stepDescription: step.description,
        stepNumber: stepIdx + 1,
        totalSteps
      };
    });

    const entry = {
      cycle: intentionLog.length + entries.length + 1,
      moves: stepMoves,
      resultingStacks: deepCloneStacks(currentStacks),
      beliefs: beliefsSnapshot,
      goalAchieved: goalAchievedFlag
    };

    if (stepIdx === 0) {
      entry.proposals = proposals;
      entry.deliberation = {
        ...deliberationResult,
        chosenAgent: Array.isArray(deliberationResult?.chosenAgents)
          ? deliberationResult.chosenAgents.join(' & ')
          : deliberationResult?.chosenAgent ?? null
      };
    }

    entries.push(entry);
  }

  return entries;
}

module.exports = {
  collaborativePlan
};
