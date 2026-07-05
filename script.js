/**
 * CALC·OS — Premium Calculator
 * script.js  |  ES6 Module-style, no external libraries
 */

'use strict';

/* ── DOM References ───────────────────────────── */
const expressionEl = document.getElementById('expression');
const resultEl     = document.getElementById('result');
const displayWrap  = document.querySelector('.display-wrap');
const btnGrid      = document.getElementById('btnGrid');
const themeSwitch  = document.getElementById('themeSwitch');
const htmlEl       = document.documentElement;

/* ── State ────────────────────────────────────── */
let state = {
  expression:    '',   // raw display string (uses ×, ÷, −)
  justEvaluated: false // prevents appending after = unless digit
};

/* ── Theme Management ─────────────────────────── */
function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  themeSwitch.checked = (theme === 'light');
  localStorage.setItem('calc-theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('calc-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || preferred);
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

/* ── Display Helpers ──────────────────────────── */

/**
 * Adjusts font size of expression to prevent overflow.
 */
function adaptFontSize() {
  const len = state.expression.length;
  let size;
  if (len <= 10)      size = 'clamp(1.5rem, 6vw, 2.2rem)';
  else if (len <= 16) size = 'clamp(1.2rem, 5vw, 1.7rem)';
  else if (len <= 22) size = 'clamp(1rem, 4vw, 1.35rem)';
  else                size = 'clamp(0.85rem, 3.5vw, 1.1rem)';
  expressionEl.style.fontSize = size;
}

/**
 * Render state to the DOM.
 * @param {boolean} [flash] - animate expression in
 */
function render(flash = false) {
  expressionEl.classList.remove('error', 'flash');

  // Force reflow to re-trigger animation
  void expressionEl.offsetWidth;

  expressionEl.textContent = state.expression || '0';

  if (flash) {
    expressionEl.classList.add('flash');
  }

  adaptFontSize();

  // Show live preview result (while typing)
  const preview = livePreview();
  resultEl.textContent = preview;
}

/**
 * Show error state.
 */
function renderError(msg = 'Error') {
  expressionEl.classList.remove('flash');
  void expressionEl.offsetWidth;
  expressionEl.textContent = msg;
  expressionEl.classList.add('error');
  resultEl.textContent = '';
  adaptFontSize();
}

/**
 * Activate display glow while user interacts.
 */
let glowTimeout;
function triggerGlow() {
  displayWrap.classList.add('glow');
  clearTimeout(glowTimeout);
  glowTimeout = setTimeout(() => displayWrap.classList.remove('glow'), 1800);
}

/* ── Expression Parsing ───────────────────────── */

/**
 * Convert display expression (with ×, ÷, −) to a JS-evaluable string.
 */
function toEvalString(expr) {
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\^/g, '**');
}

/**
 * Count open vs closed brackets in expression.
 */
function bracketBalance(expr) {
  let open = 0;
  for (const ch of expr) {
    if (ch === '(') open++;
    else if (ch === ')') open--;
  }
  return open; // positive = more opens than closes
}

/**
 * Live preview: attempt to evaluate the current expression quietly.
 */
function livePreview() {
  if (!state.expression) return '';
  try {
    const raw = toEvalString(state.expression);
    // Only preview if expression looks complete (ends with digit or close bracket)
    if (!/[\d)]$/.test(state.expression)) return '';
    const val = Function('"use strict"; return (' + raw + ')')();
    if (!isFinite(val)) return '';
    const str = formatResult(val);
    // Don't show preview if it matches the expression
    if (str === state.expression) return '';
    return '= ' + str;
  } catch {
    return '';
  }
}

/**
 * Format a numeric result nicely.
 */
function formatResult(val) {
  if (Number.isInteger(val)) return String(val);
  // Up to 10 significant digits, strip trailing zeros
  return parseFloat(val.toPrecision(10)).toString();
}

/* ── Input Logic ──────────────────────────────── */
const OPERATORS = ['+', '−', '×', '÷'];

/**
 * Get the last character of the expression.
 */
function lastChar() {
  return state.expression.slice(-1);
}

/**
 * Returns true if last char is an operator.
 */
function endsWithOperator() {
  return OPERATORS.includes(lastChar());
}

/**
 * Returns true if last char is an open bracket.
 */
function endsWithOpen() {
  return lastChar() === '(';
}

/**
 * Append a digit (0–9).
 */
function inputDigit(d) {
  if (state.justEvaluated) {
    // Start fresh after evaluation
    state.expression = d;
    state.justEvaluated = false;
  } else {
    // Don't allow leading zeros like "007"
    if (state.expression === '0' && d !== '.') {
      state.expression = d;
    } else {
      state.expression += d;
    }
  }
  render();
  triggerGlow();
}

/**
 * Append a decimal point.
 */
function inputDecimal() {
  if (state.justEvaluated) {
    state.expression = '0.';
    state.justEvaluated = false;
    render();
    triggerGlow();
    return;
  }
  // Find the last number segment and check if it already has a dot
  const segments = state.expression.split(/[\+\−\×\÷\(]/);
  const lastSeg = segments[segments.length - 1];
  if (lastSeg.includes('.')) return; // already has decimal
  if (!state.expression || endsWithOperator() || endsWithOpen()) {
    state.expression += '0.';
  } else {
    state.expression += '.';
  }
  render();
  triggerGlow();
}

/**
 * Append an operator (+, −, ×, ÷).
 */
function inputOperator(op) {
  state.justEvaluated = false;
  if (!state.expression) {
    // Allow leading minus
    if (op === '−') { state.expression = '−'; render(); triggerGlow(); }
    return;
  }
  // Replace trailing operator
  if (endsWithOperator()) {
    state.expression = state.expression.slice(0, -1) + op;
  } else if (!endsWithOpen()) {
    state.expression += op;
  }
  render();
  triggerGlow();
}

/**
 * Smart bracket: insert ( or ) based on context.
 */
function inputBracket() {
  state.justEvaluated = false;
  const balance = bracketBalance(state.expression);
  const last = lastChar();

  if (!state.expression || endsWithOperator() || last === '(') {
    // Open bracket
    state.expression += '(';
  } else if (balance > 0 && /[\d\.]/.test(last) || last === ')') {
    // Close bracket
    state.expression += ')';
  } else {
    // Default: open
    state.expression += '(';
  }
  render();
  triggerGlow();
}

/**
 * Append a % — converts last number to /100.
 */
function inputPercent() {
  if (!state.expression) return;
  state.justEvaluated = false;
  state.expression += '%';
  // Replace % with /100 in evaluation
  render();
  triggerGlow();
}

/**
 * Toggle sign of the last number in expression.
 */
function inputToggleSign() {
  if (!state.expression) return;
  state.justEvaluated = false;

  // Try to find the last number in the expression
  const match = state.expression.match(/(.*[\+\−\×\÷\(]|^)(−?)(\d+\.?\d*)$/);
  if (!match) return;

  const prefix = match[1];
  const sign   = match[2];
  const num    = match[3];

  state.expression = prefix + (sign === '−' ? '' : '−') + num;
  render();
  triggerGlow();
}

/**
 * Backspace: remove last character.
 */
function inputBackspace() {
  if (state.justEvaluated) {
    clearAll();
    return;
  }
  if (!state.expression) return;
  state.expression = state.expression.slice(0, -1);
  render();
  triggerGlow();
}

/**
 * Clear all.
 */
function clearAll() {
  state.expression = '';
  state.justEvaluated = false;
  expressionEl.classList.remove('error', 'flash');
  expressionEl.style.fontSize = '';
  render();
  displayWrap.classList.remove('glow');
}

/**
 * Evaluate the expression.
 */
function evaluate() {
  if (!state.expression) return;

  try {
    // Auto-close unclosed brackets
    const balance = bracketBalance(state.expression);
    let expr = state.expression + ')'.repeat(Math.max(0, balance));

    // Handle % -> /100
    expr = expr.replace(/(\d+\.?\d*)%/g, '($1/100)');

    const evalStr = toEvalString(expr);

    // Safety check: only allow safe math characters
    if (!/^[\d\s\+\-\*\/\.\(\)\%\^e]+$/i.test(evalStr)) {
      throw new Error('Invalid expression');
    }

    const val = Function('"use strict"; return (' + evalStr + ')')();

    if (!isFinite(val)) {
      throw new Error(val === Infinity || val === -Infinity ? 'Infinity' : 'Error');
    }

    const result = formatResult(val);

    // Show previous expression as preview, result as main
    resultEl.textContent = state.expression + ' =';
    state.expression = result;
    state.justEvaluated = true;

    render(true);
    displayWrap.classList.add('glow');
    glowTimeout = setTimeout(() => displayWrap.classList.remove('glow'), 2500);

  } catch (err) {
    renderError(err.message === 'Infinity' ? '∞ Error' : 'Invalid Expression');
    state.expression = '';
    state.justEvaluated = false;
  }
}

/* ── Button Click Handling ────────────────────── */
function handleAction(action, value) {
  switch (action) {
    case 'digit':      inputDigit(value);    break;
    case 'operator':   inputOperator(value); break;
    case 'decimal':    inputDecimal();       break;
    case 'bracket':    inputBracket();       break;
    case 'percent':    inputPercent();       break;
    case 'toggleSign': inputToggleSign();    break;
    case 'backspace':  inputBackspace();     break;
    case 'clear':      clearAll();           break;
    case 'equals':     evaluate();           break;
  }
}

/* Button press visual feedback */
function pressButton(btn) {
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 140);
}

btnGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const { action, value } = btn.dataset;
  if (!action) return;
  pressButton(btn);
  handleAction(action, value);
});

/* ── Keyboard Support ─────────────────────────── */
const keyMap = {
  '0': ['digit', '0'],   '1': ['digit', '1'],   '2': ['digit', '2'],
  '3': ['digit', '3'],   '4': ['digit', '4'],   '5': ['digit', '5'],
  '6': ['digit', '6'],   '7': ['digit', '7'],   '8': ['digit', '8'],
  '9': ['digit', '9'],

  '+': ['operator', '+'],
  '-': ['operator', '−'],
  '*': ['operator', '×'],
  '/': ['operator', '÷'],
  'x': ['operator', '×'],

  '.': ['decimal',    null],
  ',': ['decimal',    null],
  '%': ['percent',    null],
  '(': ['bracket',    null],
  ')': ['bracket',    null],

  'Enter':     ['equals',    null],
  '=':         ['equals',    null],
  'Backspace': ['backspace', null],
  'Delete':    ['clear',     null],
  'Escape':    ['clear',     null],
};

document.addEventListener('keydown', (e) => {
  // Don't interfere with theme toggle checkbox
  if (e.target === themeSwitch) return;

  const mapped = keyMap[e.key];
  if (!mapped) return;

  e.preventDefault();

  const [action, value] = mapped;
  handleAction(action, value);

  // Visually highlight the matching button
  const selector = `[data-action="${action}"]` +
    (value ? `[data-value="${value}"]` : '');
  const matchBtn = btnGrid.querySelector(selector);
  if (matchBtn) pressButton(matchBtn);
});

/* ── Click Sound (optional, minimal) ─────────── */
function createClickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(900, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.07);
    };
  } catch { return () => {}; }
}

const playClick = createClickSound();

btnGrid.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn')) playClick();
});

/* ── Init ─────────────────────────────────────── */
initTheme();
render();