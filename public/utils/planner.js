/**
 * Planner API Communication
 * 
 * Handles communication with the backend BDI planner endpoint
 */

import { authenticatedFetch } from './auth.js';
import { API_BASE } from './constants.js';

/**
 * Request a BDI plan from the backend
 * @param {Array<Array<string>>} stacks - Current block stacks
 * @param {Array<string>} goalChain - Goal chain to achieve
 * @param {Object} options - Planner options
 * @returns {Promise<Object>} Planner response
 */
export async function requestBDIPlan(stacks, goalChain, options = {}) {
  const payload = {
    stacks,
    goalChain,
    plannerOptions: {
      maxIterations: options.maxIterations || window.APP_CONFIG?.PLANNER?.MAX_ITERATIONS || 2500
    }
  };

  const response = await authenticatedFetch(`${API_BASE}/plan`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const error = new Error(errorData.message || `Planner request failed: ${response.statusText}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return await response.json();
}

/**
 * Request a multi-agent BDI plan from the backend
 * @param {Array<Array<string>>} stacks - Current block stacks
 * @param {Array<string>} goalChain - Goal chain to achieve
 * @param {Object} options - Multi-agent planner options
 * @returns {Promise<Object>} Multi-agent planner response
 */
export async function requestMultiAgentPlan(stacks, goalChain, options = {}) {
  const payload = {
    stacks,
    goalChain,
    options: {
      maxIterations: options.maxIterations || 1000,
      deliberationTimeout: options.deliberationTimeout || 5000,
      enableNegotiation: options.enableNegotiation !== false,
      goalChains: Array.isArray(options.goalChains) ? options.goalChains : undefined
    }
  };

  if (Array.isArray(options.goalChains)) {
    payload.goalChains = options.goalChains;
  }

  const response = await authenticatedFetch(`${API_BASE}/multi-agent-plan`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const error = new Error(errorData.message || `Multi-agent planner request failed: ${response.statusText}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return await response.json();
}
