/**
 * Money Tracker - Core Application Logic
 * Pure Vanilla JavaScript with LocalStorage persistence.
 */

// --- Application State ---
const STORAGE_KEY = 'money_tracker_transactions_v1';

let transactions = [];
let editingId = null;
let searchQuery = '';
let pendingDeleteId = null;

// --- DOM Elements ---
const form = document.getElementById('transactionForm');
const formTitle = document.getElementById('formTitle');
const editBadge = document.getElementById('editBadge');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const descriptionInput = document.getElementById('descriptionInput');
const amountInput = document.getElementById('amountInput');
const descriptionError = document.getElementById('descriptionError');
const amountError = document.getElementById('amountError');

const totalTransactionsCount = document.getElementById('totalTransactionsCount');
const netBalance = document.getElementById('netBalance');
const totalIncome = document.getElementById('totalIncome');
const totalExpenses = document.getElementById('totalExpenses');

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filteredCountBadge = document.getElementById('filteredCountBadge');

const transactionList = document.getElementById('transactionList');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResultsState');

// Confirmation Modal Elements
const confirmModal = document.getElementById('confirmModal');
const modalDescription = document.getElementById('modalDescription');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// --- Helper Functions ---

/**
 * Format number into Nigerian Naira currency format (₦X,XXX.XX)
 */
function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `₦${formatted}`;
}

/**
 * Format timestamp into readable date
 */
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Sanitize strings to prevent XSS
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Load transactions from localStorage
 */
function loadTransactions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        transactions = parsed;
      }
    }
  } catch (err) {
    console.error('Error loading data from localStorage:', err);
    transactions = [];
  }
}

/**
 * Save transactions to localStorage
 */
function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error('Error saving data to localStorage:', err);
    alert('Unable to save transaction. Your browser storage might be full.');
  }
}

// --- Summary & Dashboard Calculations ---

/**
 * Recalculate and update top summaries:
 * 1. Total number of transactions (Featured at top)
 * 2. Net Balance
 * 3. Total Income
 * 4. Total Expenses
 */
function updateSummary() {
  const count = transactions.length;
  totalTransactionsCount.textContent = count.toLocaleString();

  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const t of transactions) {
    const val = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      incomeTotal += val;
    } else {
      expenseTotal += val;
    }
  }

  const balance = incomeTotal - expenseTotal;

  // Format and assign
  totalIncome.textContent = `+${formatCurrency(incomeTotal)}`;
  totalExpenses.textContent = `-${formatCurrency(expenseTotal)}`;
  
  if (balance >= 0) {
    netBalance.textContent = formatCurrency(balance);
    netBalance.classList.remove('expense-text');
  } else {
    netBalance.textContent = `-${formatCurrency(Math.abs(balance))}`;
    netBalance.classList.add('expense-text');
  }
}

// --- Render Transactions List ---

/**
 * Filter transactions by search query and render the list
 */
function renderList() {
  const query = searchQuery.trim().toLowerCase();

  // Filter based on description, amount or type
  const filtered = transactions.filter(t => {
    if (!query) return true;
    const descMatch = (t.description || '').toLowerCase().includes(query);
    const typeMatch = (t.type || '').toLowerCase().includes(query);
    const amountMatch = t.amount.toString().includes(query);
    return descMatch || typeMatch || amountMatch;
  });

  filteredCountBadge.textContent = filtered.length;

  // Update clear search button visibility
  if (query.length > 0) {
    clearSearchBtn.classList.remove('hidden');
  } else {
    clearSearchBtn.classList.add('hidden');
  }

  // Handle empty states
  if (transactions.length === 0) {
    // No transactions in the app at all
    transactionList.innerHTML = '';
    emptyState.classList.remove('hidden');
    noResultsState.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (filtered.length === 0) {
    // Has transactions, but search yielded no results
    transactionList.innerHTML = '';
    noResultsState.classList.remove('hidden');
    return;
  }

  noResultsState.classList.add('hidden');

  // Build the list HTML
  transactionList.innerHTML = filtered.map(t => {
    const isIncome = t.type === 'income';
    const sign = isIncome ? '+' : '-';
    const typeClass = isIncome ? 'type-income' : 'type-expense';
    const isCurrentlyEditing = editingId === t.id;

    // SVG icon for Income vs Expense
    const iconSVG = isIncome
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <line x1="12" y1="19" x2="12" y2="5"/>
           <polyline points="5 12 12 5 19 12"/>
         </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <line x1="12" y1="5" x2="12" y2="19"/>
           <polyline points="19 12 12 19 5 12"/>
         </svg>`;

    return `
      <li class="transaction-item ${typeClass} ${isCurrentlyEditing ? 'is-editing' : ''}" data-id="${t.id}">
        <div class="item-left">
          <div class="item-badge-icon" aria-hidden="true">
            ${iconSVG}
          </div>
          <div class="item-details">
            <span class="item-description" title="${escapeHTML(t.description)}">
              ${escapeHTML(t.description)}
            </span>
            <div class="item-meta">
              <span class="item-type-tag">${t.type}</span>
              ${t.date ? `<span>•</span><span>${formatDate(t.date)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="item-right">
          <span class="item-amount">${sign}${formatCurrency(t.amount)}</span>
          <div class="item-actions">
            <button 
              type="button" 
              class="action-btn edit-btn" 
              data-action="edit" 
              data-id="${t.id}" 
              title="Edit Transaction" 
              aria-label="Edit ${escapeHTML(t.description)}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button 
              type="button" 
              class="action-btn delete-btn" 
              data-action="delete" 
              data-id="${t.id}" 
              title="Delete Transaction" 
              aria-label="Delete ${escapeHTML(t.description)}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </li>
    `;
  }).join('');
}

/**
 * Full UI re-render
 */
function render() {
  updateSummary();
  renderList();
}

// --- Form Validation & Submission ---

function clearErrors() {
  descriptionInput.classList.remove('has-error');
  descriptionError.classList.remove('visible');
  amountInput.classList.remove('has-error');
  amountError.classList.remove('visible');
}

/**
 * Validate input fields
 */
function validateInputs() {
  let isValid = true;
  clearErrors();

  const descVal = descriptionInput.value.trim();
  const amountVal = parseFloat(amountInput.value);

  if (!descVal) {
    descriptionInput.classList.add('has-error');
    descriptionError.classList.add('visible');
    isValid = false;
  }

  if (isNaN(amountVal) || amountVal <= 0) {
    amountInput.classList.add('has-error');
    amountError.classList.add('visible');
    isValid = false;
  }

  return isValid;
}

/**
 * Handle Add or Update Transaction
 */
form.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateInputs()) {
    return;
  }

  const desc = descriptionInput.value.trim();
  const amount = Math.round(parseFloat(amountInput.value) * 100) / 100; // Round to 2 decimals
  const selectedType = form.elements['transactionType'].value;

  if (editingId) {
    // Update existing transaction
    const index = transactions.findIndex(t => t.id === editingId);
    if (index !== -1) {
      transactions[index].description = desc;
      transactions[index].amount = amount;
      transactions[index].type = selectedType;
      // Retain original date or update timestamp if desired
    }
    cancelEditMode();
  } else {
    // Add new transaction
    const newTransaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      description: desc,
      amount: amount,
      type: selectedType,
      date: new Date().toISOString()
    };
    // Prepend so the latest appears first
    transactions.unshift(newTransaction);
    resetForm();
  }

  saveTransactions();
  render();
});

// Clear input errors as user types
descriptionInput.addEventListener('input', () => {
  if (descriptionInput.value.trim()) {
    descriptionInput.classList.remove('has-error');
    descriptionError.classList.remove('visible');
  }
});

amountInput.addEventListener('input', () => {
  const val = parseFloat(amountInput.value);
  if (!isNaN(val) && val > 0) {
    amountInput.classList.remove('has-error');
    amountError.classList.remove('visible');
  }
});

// --- Edit Mode ---

/**
 * Switch form into Edit Mode for a transaction
 */
function startEdit(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;

  editingId = id;
  descriptionInput.value = item.description;
  amountInput.value = item.amount;
  form.elements['transactionType'].value = item.type;

  formTitle.textContent = 'Edit Transaction';
  editBadge.classList.remove('hidden');
  submitBtnText.textContent = 'Save Changes';
  cancelEditBtn.classList.remove('hidden');

  clearErrors();
  renderList(); // Re-render to highlight selected row

  // Scroll smoothly to form and focus
  document.getElementById('formSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
  descriptionInput.focus();
}

/**
 * Cancel Edit Mode and restore standard form state
 */
function cancelEditMode() {
  editingId = null;
  resetForm();
  formTitle.textContent = 'Add New Transaction';
  editBadge.classList.add('hidden');
  submitBtnText.textContent = 'Add Transaction';
  cancelEditBtn.classList.add('hidden');
  clearErrors();
  renderList();
}

cancelEditBtn.addEventListener('click', cancelEditMode);

function resetForm() {
  form.reset();
  form.elements['transactionType'].value = 'expense'; // default back to expense
}

// --- Delete with Confirmation ---

/**
 * Request confirmation before deleting
 */
function requestDelete(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;

  pendingDeleteId = id;
  modalDescription.textContent = `Are you sure you want to delete "${item.description}" (${formatCurrency(item.amount)})? This action cannot be undone.`;
  confirmModal.classList.remove('hidden');
  modalConfirmBtn.focus();
}

/**
 * Close confirmation modal
 */
function closeModal() {
  confirmModal.classList.add('hidden');
  pendingDeleteId = null;
}

/**
 * Confirm and execute delete
 */
modalConfirmBtn.addEventListener('click', () => {
  if (pendingDeleteId) {
    // If the transaction being deleted is currently in edit mode, exit edit mode
    if (editingId === pendingDeleteId) {
      cancelEditMode();
    }

    transactions = transactions.filter(t => t.id !== pendingDeleteId);
    saveTransactions();
    render();
  }
  closeModal();
});

modalCancelBtn.addEventListener('click', closeModal);

// Close modal when clicking outside of the modal card
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) {
    closeModal();
  }
});

// Escape key closes modal or cancels edit
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!confirmModal.classList.contains('hidden')) {
      closeModal();
    } else if (editingId) {
      cancelEditMode();
    }
  }
});

// --- Delegated Click Events for List (Edit & Delete) ---

transactionList.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('.action-btn');
  if (!actionBtn) return;

  const action = actionBtn.getAttribute('data-action');
  const id = actionBtn.getAttribute('data-id');

  if (action === 'edit') {
    startEdit(id);
  } else if (action === 'delete') {
    requestDelete(id);
  }
});

// --- Search Functionality ---

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderList();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchInput.focus();
  renderList();
});

resetSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchInput.focus();
  renderList();
});

// --- Initialize App ---
function init() {
  loadTransactions();
  render();
}

// Run on load
document.addEventListener('DOMContentLoaded', init);
// Run immediately in case DOMContentLoaded already fired
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  init();
}

