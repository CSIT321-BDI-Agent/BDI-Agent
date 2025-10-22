/**
 * Import/Export Module
 * 
 * Handles importing and exporting world configurations as JSON
 */

import { API_BASE } from './constants.js';
import { 
  authenticatedFetch, 
  getCurrentUser, 
  requireAuth, 
  logout as authLogout,
  updateUIWithUserInfo 
} from './auth.js';
import { showMessage, handleError, normalizeWorldIdentifier } from './helpers.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { initializeProfileMenu } from './profile.js';

/**
 * Initialize the import/export page
 */
async function init() {
  // Require authentication
  requireAuth();

  // Initialize navigation components
  initializeMobileNavigation();
  initializeSidebarNavigation({ 
    activeRoute: 'import-export', 
    storageKey: 'bdiSidebarCollapsed' 
  });
  initializeProfileMenu();

  // Update UI with user info
  updateUIWithUserInfo({
    adminNav: '.admin-nav-link'
  });

  // Make logout available globally
  window.logout = authLogout;

  // Load saved worlds into the export dropdown
  await loadWorldsList();

  // Set up event listeners
  setupEventListeners();
}

/**
 * Load the list of saved worlds for export
 */
async function loadWorldsList() {
  const exportSelect = document.getElementById('exportWorldSelect');
  if (!exportSelect) return;

  const user = getCurrentUser();
  if (!user) {
    exportSelect.innerHTML = '<option value="">Log in to export worlds</option>';
    return;
  }

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Failed to load worlds');
    }

    const worlds = await response.json();

    if (!Array.isArray(worlds) || worlds.length === 0) {
      exportSelect.innerHTML = '<option value="">No saved worlds yet</option>';
      return;
    }

    // Build options
    exportSelect.innerHTML = '<option value="">Select a world to export</option>';
    worlds.forEach(world => {
      const option = document.createElement('option');
      const id = normalizeWorldIdentifier(world);
      option.value = id;
      option.textContent = world.name || 'Unnamed World';
      option.dataset.world = JSON.stringify(world);
      exportSelect.appendChild(option);
    });
  } catch (error) {
    handleError(error, 'loading worlds list');
    exportSelect.innerHTML = '<option value="">Error loading worlds</option>';
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Export buttons
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const exportWorldSelect = document.getElementById('exportWorldSelect');

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', handleExportJson);
  }

  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', handleCopyJson);
  }

  if (exportWorldSelect) {
    exportWorldSelect.addEventListener('change', handleExportWorldChange);
  }

  // Import buttons
  const uploadJsonBtn = document.getElementById('uploadJsonBtn');
  const validateJsonBtn = document.getElementById('validateJsonBtn');
  const importJsonBtn = document.getElementById('importJsonBtn');
  const fileInput = document.getElementById('fileInput');

  if (uploadJsonBtn && fileInput) {
    uploadJsonBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  if (validateJsonBtn) {
    validateJsonBtn.addEventListener('click', handleValidateJson);
  }

  if (importJsonBtn) {
    importJsonBtn.addEventListener('click', handleImportJson);
  }
}

/**
 * Handle export world selection change
 */
function handleExportWorldChange(event) {
  const select = event.target;
  const selectedOption = select.options[select.selectedIndex];
  
  if (!selectedOption || !selectedOption.dataset.world) {
    // Hide preview
    const exportPreview = document.getElementById('exportPreview');
    if (exportPreview) {
      exportPreview.classList.add('hidden');
    }
    return;
  }

  try {
    const worldData = JSON.parse(selectedOption.dataset.world);
    displayExportPreview(worldData);
  } catch (error) {
    handleError(error, 'parsing world data');
  }
}

/**
 * Display the export preview
 */
function displayExportPreview(worldData) {
  const exportPreview = document.getElementById('exportPreview');
  const exportJsonDisplay = document.getElementById('exportJsonDisplay');

  if (!exportPreview || !exportJsonDisplay) return;

  // Format the JSON for display
  const formattedJson = JSON.stringify(worldData, null, 2);
  exportJsonDisplay.value = formattedJson;

  // Show the preview
  exportPreview.classList.remove('hidden');
}

/**
 * Handle exporting JSON as a file
 */
function handleExportJson() {
  const select = document.getElementById('exportWorldSelect');
  const selectedOption = select?.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.dataset.world) {
    showMessage('Please select a world to export', 'error');
    return;
  }

  try {
    const worldData = JSON.parse(selectedOption.dataset.world);
    
    // Create a blob with the JSON data
    const jsonString = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${worldData.name || 'world'}.json`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(`Successfully exported "${worldData.name}"`, 'success');
  } catch (error) {
    handleError(error, 'exporting world');
  }
}

/**
 * Handle copying JSON to clipboard
 */
async function handleCopyJson() {
  const select = document.getElementById('exportWorldSelect');
  const selectedOption = select?.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.dataset.world) {
    showMessage('Please select a world to copy', 'error');
    return;
  }

  try {
    const worldData = JSON.parse(selectedOption.dataset.world);
    const jsonString = JSON.stringify(worldData, null, 2);
    
    // Copy to clipboard
    await navigator.clipboard.writeText(jsonString);
    
    showMessage('JSON copied to clipboard!', 'success');
  } catch (error) {
    handleError(error, 'copying to clipboard');
  }
}

/**
 * Handle file upload
 */
function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  
  reader.onload = (e) => {
    const content = e.target?.result;
    const importJsonInput = document.getElementById('importJsonInput');
    
    if (importJsonInput && typeof content === 'string') {
      importJsonInput.value = content;
      showMessage(`File "${file.name}" loaded successfully`, 'success');
      
      // Auto-validate after loading
      setTimeout(() => handleValidateJson(), 100);
    }
  };
  
  reader.onerror = () => {
    showMessage('Error reading file', 'error');
  };
  
  reader.readAsText(file);
  
  // Reset file input
  event.target.value = '';
}

/**
 * Validate the JSON input
 */
function handleValidateJson() {
  const importJsonInput = document.getElementById('importJsonInput');
  const importPreview = document.getElementById('importPreview');
  const importPreviewContent = document.getElementById('importPreviewContent');
  const importMessages = document.getElementById('importMessages');

  if (!importJsonInput) return;

  const jsonText = importJsonInput.value.trim();

  if (!jsonText) {
    showMessage('Please paste or upload JSON first', 'error');
    if (importPreview) importPreview.classList.add('hidden');
    return;
  }

  try {
    const worldData = JSON.parse(jsonText);
    
    // Validate the structure
    const validation = validateWorldStructure(worldData);
    
    if (!validation.valid) {
      if (importMessages) {
        importMessages.className = 'border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700';
        importMessages.innerHTML = `<strong>Validation Errors:</strong><ul class="list-disc list-inside mt-2">${validation.errors.map(err => `<li>${err}</li>`).join('')}</ul>`;
        importMessages.classList.remove('hidden');
      }
      if (importPreview) importPreview.classList.add('hidden');
      return;
    }

    // Display preview
    if (importPreviewContent) {
      importPreviewContent.innerHTML = `
        <div class="flex justify-between"><strong>World Name:</strong> <span>${worldData.name || 'Unnamed'}</span></div>
        <div class="flex justify-between"><strong>Blocks:</strong> <span>${worldData.blocks?.length || 0} blocks (${(worldData.blocks || []).join(', ')})</span></div>
        <div class="flex justify-between"><strong>Stacks:</strong> <span>${worldData.stacks?.length || 0} stacks</span></div>
        <div class="flex justify-between"><strong>Has Colors:</strong> <span>${worldData.colours || worldData.colors ? 'Yes' : 'No'}</span></div>
        <div class="flex justify-between"><strong>Has Timeline:</strong> <span>${worldData.timeline ? 'Yes' : 'No'}</span></div>
        <div class="flex justify-between"><strong>Has Stats:</strong> <span>${worldData.stats ? 'Yes' : 'No'}</span></div>
      `;
    }

    if (importPreview) {
      importPreview.classList.remove('hidden');
    }

    if (importMessages) {
      importMessages.className = 'border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700';
      importMessages.textContent = '✓ JSON is valid and ready to import';
      importMessages.classList.remove('hidden');
    }

    showMessage('JSON validated successfully!', 'success');
  } catch (error) {
    if (importMessages) {
      importMessages.className = 'border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700';
      importMessages.textContent = `Invalid JSON: ${error.message}`;
      importMessages.classList.remove('hidden');
    }
    if (importPreview) importPreview.classList.add('hidden');
    showMessage(`JSON validation failed: ${error.message}`, 'error');
  }
}

/**
 * Validate world structure
 */
function validateWorldStructure(worldData) {
  const errors = [];

  // Check required fields
  if (!worldData.name || typeof worldData.name !== 'string') {
    errors.push('Missing or invalid "name" field (must be a string)');
  }

  if (!Array.isArray(worldData.blocks)) {
    errors.push('Missing or invalid "blocks" field (must be an array)');
  } else {
    // Validate each block
    worldData.blocks.forEach((block, idx) => {
      if (typeof block !== 'string' || block.length !== 1 || !/^[A-Z]$/.test(block)) {
        errors.push(`Invalid block at index ${idx}: "${block}" (must be a single uppercase letter)`);
      }
    });

    // Check for duplicates
    const uniqueBlocks = new Set(worldData.blocks);
    if (uniqueBlocks.size !== worldData.blocks.length) {
      errors.push('Duplicate blocks found in "blocks" array');
    }
  }

  if (!Array.isArray(worldData.stacks)) {
    errors.push('Missing or invalid "stacks" field (must be an array of arrays)');
  } else {
    // Validate each stack
    const allStackBlocks = new Set();
    worldData.stacks.forEach((stack, stackIdx) => {
      if (!Array.isArray(stack)) {
        errors.push(`Stack at index ${stackIdx} is not an array`);
        return;
      }

      stack.forEach((block, blockIdx) => {
        if (typeof block !== 'string' || block.length !== 1 || !/^[A-Z]$/.test(block)) {
          errors.push(`Invalid block "${block}" in stack ${stackIdx}, position ${blockIdx}`);
        }
        
        if (allStackBlocks.has(block)) {
          errors.push(`Duplicate block "${block}" found in stacks`);
        }
        allStackBlocks.add(block);
      });
    });

    // Verify all blocks in stacks are in blocks array
    if (Array.isArray(worldData.blocks)) {
      const blocksSet = new Set(worldData.blocks);
      allStackBlocks.forEach(block => {
        if (!blocksSet.has(block)) {
          errors.push(`Block "${block}" in stacks is not in blocks array`);
        }
      });

      // Verify all blocks are in stacks
      worldData.blocks.forEach(block => {
        if (!allStackBlocks.has(block)) {
          errors.push(`Block "${block}" in blocks array is not in any stack`);
        }
      });
    }
  }

  // Validate optional fields if present
  if (worldData.colours || worldData.colors) {
    const colours = worldData.colours || worldData.colors;
    if (typeof colours !== 'object' || Array.isArray(colours)) {
      errors.push('Field "colours" must be an object');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Handle importing JSON and saving it
 */
async function handleImportJson() {
  const importJsonInput = document.getElementById('importJsonInput');
  
  if (!importJsonInput) return;

  const jsonText = importJsonInput.value.trim();

  if (!jsonText) {
    showMessage('Please paste or upload JSON first', 'error');
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    showMessage('You must be logged in to import worlds', 'error');
    return;
  }

  try {
    const worldData = JSON.parse(jsonText);
    
    // Validate first
    const validation = validateWorldStructure(worldData);
    if (!validation.valid) {
      showMessage(`Validation failed: ${validation.errors[0]}`, 'error');
      return;
    }

    // Confirm import
    const confirmMsg = `Import world "${worldData.name}"?\n\nThis will create a new saved world with ${worldData.blocks?.length || 0} blocks.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    // Prepare payload (remove _id, createdAt, updatedAt if present)
    const payload = {
      name: worldData.name,
      blocks: worldData.blocks,
      stacks: worldData.stacks,
      colours: worldData.colours || worldData.colors || {},
      timeline: worldData.timeline || null,
      stats: worldData.stats || null
    };

    // Save to backend
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || 'Failed to import world');
    }

    const savedWorld = await response.json();

    showMessage(`World "${worldData.name}" imported successfully!`, 'success');

    // Clear the input
    importJsonInput.value = '';
    
    // Hide preview
    const importPreview = document.getElementById('importPreview');
    const importMessages = document.getElementById('importMessages');
    if (importPreview) importPreview.classList.add('hidden');
    if (importMessages) importMessages.classList.add('hidden');

    // Reload the worlds list
    await loadWorldsList();

    // Select the newly imported world in export dropdown
    const exportSelect = document.getElementById('exportWorldSelect');
    if (exportSelect && savedWorld) {
      const id = normalizeWorldIdentifier(savedWorld);
      if (id) {
        exportSelect.value = id;
        exportSelect.dispatchEvent(new Event('change'));
      }
    }
  } catch (error) {
    handleError(error, 'importing world');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
