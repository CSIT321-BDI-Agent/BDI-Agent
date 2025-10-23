/**
 * Async Runner for Multi-Agent Deliberation Cycles
 * 
 * Supports async deliberation before each BDI cycle execution
 */

/**
 * Creates an async-aware runner for multi-agent deliberation
 * 
 * Unlike standard js-son-agent runner, this supports:
 * - Async state updates (deliberation takes time)
 * - Timeout handling
 * - Goal achievement checking per cycle
 * 
 * @param {number} maxIterations - Maximum cycles to run
 * @param {Function} goalCheckFn - Function to check if goal is achieved
 * @returns {Function} Runner function compatible with js-son-agent Environment
 */
function createAsyncRunner(maxIterations, goalCheckFn = null) {
  return (step) => async (iterations = maxIterations) => {
    let currentIteration = 0;
    let goalAchieved = false;
    const startTime = Date.now();

    while (currentIteration < iterations && !goalAchieved) {
      try {
        // Execute one BDI cycle (async)
        // step() triggers belief updates, plan selection, and action execution
        await step();
        
        currentIteration++;

        // Check goal achievement if function provided
        if (goalCheckFn) {
          goalAchieved = await goalCheckFn();
        }

        // Prevent infinite loops with timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > 300000) { // 5 minute safety timeout
          console.warn('Multi-agent runner timeout after 5 minutes');
          break;
        }

      } catch (error) {
        console.error('Error in multi-agent cycle', currentIteration, error);
        throw error;
      }
    }

    return {
      totalIterations: currentIteration,
      goalAchieved,
      elapsedMs: Date.now() - startTime,
      terminated: currentIteration >= iterations
    };
  };
}

/**
 * Creates a simple synchronous runner (fallback)
 * 
 * @param {number} maxIterations
 * @returns {Function}
 */
function createSyncRunner(maxIterations) {
  return (step) => (iterations = maxIterations) => {
    let currentIteration = 0;

    while (currentIteration < iterations) {
      step();
      currentIteration++;
    }

    return {
      totalIterations: currentIteration,
      terminated: currentIteration >= iterations
    };
  };
}

module.exports = {
  createAsyncRunner,
  createSyncRunner
};
