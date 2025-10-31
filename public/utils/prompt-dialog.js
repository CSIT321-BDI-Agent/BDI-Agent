/**
 * Overlay prompt utilities
 *
 * Provides reusable text input prompts rendered as full-screen overlays.
 */

const SELECTORS = {
  root: 'worldPromptOverlay',
  dialog: '[data-role="prompt-dialog"]',
  backdrop: '[data-role="prompt-backdrop"]',
  form: 'worldPromptForm',
  input: 'worldPromptInput',
  title: 'worldPromptTitle',
  message: 'worldPromptMessage',
  label: 'worldPromptLabel',
  error: 'worldPromptError',
  confirm: 'worldPromptConfirm',
  cancel: 'worldPromptCancel'
};

let cachedElements = null;
let activePrompt = null;
let previousBodyOverflow = null;

const createOverlayStructure = () => {
  if (!document?.body) {
    throw new Error('Document body is not ready for prompt overlay creation.');
  }

  const root = document.createElement('div');
  root.id = SELECTORS.root;
  root.className = 'fixed inset-0 hidden';
  root.style.zIndex = '9999';
  root.style.backgroundColor = 'rgba(0,0,0,0.4)';
  root.setAttribute('aria-hidden', 'true');

  root.innerHTML = `
    <div class="absolute inset-0" data-role="prompt-backdrop" style="background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);"></div>
    <div class="relative flex min-h-screen items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div
        class="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="worldPromptTitle"
        aria-describedby="worldPromptMessage"
        data-role="prompt-dialog"
      >
        <div class="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 id="worldPromptTitle" class="text-lg font-semibold text-brand-dark">Save World</h2>
        </div>
        <form id="worldPromptForm" class="space-y-5 px-6 py-6">
          <p id="worldPromptMessage" class="text-sm text-slate-600">
            Enter a name for this world. Choose something descriptive so you can find it later.
          </p>
          <div>
            <label for="worldPromptInput" id="worldPromptLabel" class="block text-sm font-semibold text-brand-dark">
              World Name
            </label>
            <input
              type="text"
              id="worldPromptInput"
              name="worldName"
              class="w-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:ring-brand-primary"
              placeholder="My saved world"
              autocomplete="off"
              required
            />
            <p id="worldPromptError" class="mt-2 hidden text-sm font-medium text-red-600"></p>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              id="worldPromptCancel"
              class="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="worldPromptConfirm"
              class="inline-flex items-center rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
};

const ensureElements = () => {
  if (cachedElements) {
    return cachedElements;
  }

  let root = document.getElementById(SELECTORS.root);
  if (!root) {
    root = createOverlayStructure();
  }

  const dialog = root.querySelector(SELECTORS.dialog);
  const backdrop = root.querySelector(SELECTORS.backdrop) || root;
  const form = document.getElementById(SELECTORS.form);
  const input = document.getElementById(SELECTORS.input);
  const title = document.getElementById(SELECTORS.title);
  const message = document.getElementById(SELECTORS.message);
  const label = document.getElementById(SELECTORS.label);
  const error = document.getElementById(SELECTORS.error);
  const confirm = document.getElementById(SELECTORS.confirm);
  const cancel = document.getElementById(SELECTORS.cancel);

  if (!dialog || !form || !input || !title || !message || !label || !error || !confirm || !cancel) {
    throw new Error('Prompt overlay markup is incomplete.');
  }

  cachedElements = {
    root,
    dialog,
    backdrop,
    form,
    input,
    title,
    message,
    label,
    error,
    confirm,
    cancel
  };

  return cachedElements;
};

const lockBodyScroll = () => {
  if (previousBodyOverflow !== null) {
    return;
  }
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
  if (previousBodyOverflow === null) {
    return;
  }
  if (previousBodyOverflow) {
    document.body.style.overflow = previousBodyOverflow;
  } else {
    document.body.style.removeProperty('overflow');
  }
  previousBodyOverflow = null;
};

const showOverlay = (elements) => {
  lockBodyScroll();
  elements.root.classList.remove('hidden');
  elements.root.setAttribute('aria-hidden', 'false');
  elements.root.dataset.state = 'open';
};

const hideOverlay = (elements) => {
  elements.root.classList.add('hidden');
  elements.root.setAttribute('aria-hidden', 'true');
  delete elements.root.dataset.state;
  unlockBodyScroll();
};

const clearError = (elements) => {
  elements.error.textContent = '';
  elements.error.classList.add('hidden');
  elements.error.removeAttribute('role');
  elements.input.removeAttribute('aria-invalid');
};

const displayError = (elements, message) => {
  elements.error.textContent = message;
  elements.error.classList.remove('hidden');
  elements.error.setAttribute('role', 'alert');
  elements.input.setAttribute('aria-invalid', 'true');
};

/**
 * Display a generic text prompt overlay.
 * @param {Object} options
 * @param {string} options.title - Heading text
 * @param {string} options.message - Body text (deprecated, use body)
 * @param {string} options.body - Body text
 * @param {string} [options.inputLabel='Value'] - Label for the input field
 * @param {string} [options.confirmLabel='Confirm']
 * @param {string} [options.cancelLabel='Cancel']
 * @param {string} [options.placeholder='']
 * @param {string} [options.defaultValue='']
 * @param {string} [options.inputType='text']
 * @param {Object} [options.inputAttributes] - Additional attributes to assign to the input element
 * @param {function} [options.validate] - Should return true when valid, or an error message string.
 * @param {function} [options.transform] - Allows transforming the result before resolving.
 * @returns {Promise<string|null>} Resolved value (transformed) or null if cancelled.
 */
export function showTextPrompt(options = {}) {
  if (activePrompt) {
    return activePrompt.promise;
  }

  const elements = ensureElements();

  const {
    title = 'Confirm action',
    body,
    message,
    inputLabel = 'Value',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    placeholder = '',
    defaultValue = '',
    inputType = 'text',
    inputAttributes = {},
    validate,
    transform
  } = options;

  const bodyText = typeof body === 'string' ? body : (typeof message === 'string' ? message : 'Enter a value to continue.');

  elements.title.textContent = title;
  elements.message.textContent = bodyText;
  elements.label.textContent = inputLabel;
  elements.confirm.textContent = confirmLabel;
  elements.cancel.textContent = cancelLabel;
  elements.input.placeholder = placeholder;
  elements.input.type = inputType || 'text';

  Object.entries(inputAttributes || {}).forEach(([key, value]) => {
    if (value === false || value == null) {
      elements.input.removeAttribute(key);
    } else {
      elements.input.setAttribute(key, String(value));
    }
  });

  elements.input.value = defaultValue != null ? defaultValue : '';
  clearError(elements);

  const previouslyFocused = document.activeElement;
  showOverlay(elements);

  const removeListeners = [];

  const promptPromise = new Promise((resolve) => {
    let settled = false;

    const complete = (result) => {
      if (settled) return;
      settled = true;
      removeListeners.forEach(off => off());
      hideOverlay(elements);
      clearError(elements);
      elements.input.value = '';
      activePrompt = null;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      resolve(result);
    };

    const handleCancel = (event) => {
      if (event) event.preventDefault();
      complete(null);
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      const rawValue = elements.input.value;
      const transformedValue = typeof transform === 'function' ? transform(rawValue) : rawValue.trim();
      const validationResult = typeof validate === 'function'
        ? validate(transformedValue, rawValue)
        : (transformedValue ? true : 'Please enter a value.');

      if (validationResult !== true) {
        const messageText = typeof validationResult === 'string' && validationResult.trim().length
          ? validationResult.trim()
          : 'Please provide a valid value.';
        displayError(elements, messageText);
        elements.input.focus();
        return;
      }

      complete(transformedValue);
    };

    const handleBackdropClick = (event) => {
      if (event.target === elements.root || event.target === elements.backdrop) {
        handleCancel(event);
      }
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel(event);
      }
    };

    const handleInput = () => clearError(elements);

    elements.form.addEventListener('submit', handleSubmit);
    removeListeners.push(() => elements.form.removeEventListener('submit', handleSubmit));

    elements.cancel.addEventListener('click', handleCancel);
    removeListeners.push(() => elements.cancel.removeEventListener('click', handleCancel));

    elements.root.addEventListener('click', handleBackdropClick);
    removeListeners.push(() => elements.root.removeEventListener('click', handleBackdropClick));

    elements.input.addEventListener('input', handleInput);
    removeListeners.push(() => elements.input.removeEventListener('input', handleInput));

    window.addEventListener('keydown', handleKeydown);
    removeListeners.push(() => window.removeEventListener('keydown', handleKeydown));

    activePrompt = { close: complete };

    requestAnimationFrame(() => {
      elements.input.focus();
      elements.input.select();
    });
  });

  activePrompt = { promise: promptPromise };

  return promptPromise;
}

/**
 * Prompt specifically for a world name, enforcing non-empty input.
 * @param {Object} [options]
 * @param {string} [options.defaultValue]
 * @returns {Promise<string|null>}
 */
export function promptForWorldName(options = {}) {
  const defaults = {
    title: 'Save World',
    body: 'Enter a name for this world. Choose something descriptive so you can find it later.',
    inputLabel: 'World name',
    confirmLabel: 'Save',
    cancelLabel: 'Cancel',
    placeholder: 'My saved world',
    transform: (value) => (typeof value === 'string' ? value.trim() : ''),
    validate: (value) => {
      if (!value || !value.trim().length) {
        return 'Please enter a world name before saving.';
      }
      if (value.length > 80) {
        return 'World names must be 80 characters or fewer.';
      }
      return true;
    }
  };

  const merged = { ...defaults, ...options };
  return showTextPrompt(merged);
}
