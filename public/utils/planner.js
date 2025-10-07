/**
 * Planner API Communication
 * 
 * Handles communication with the backend BDI planner endpoint
 */

import { authenticatedFetch } from './auth.js';

/**
 * Request a BDI plan from the backend
 * @param {Array<Array<string>>} stacks - Current block stacks
 * @param {Array<string>} goalChain - Goal chain to achieve
 * @param {Object} options - Planner options
 * @returns {Promise<Object>} Planner response
 */
export async function requestBDIPlan(stacks, goalChain, options = {}) {
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';
  
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
