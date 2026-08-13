/**
 * Toast Notification Component
 */
import { escapeHtml } from '../utils/helpers.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0';
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = 'info', duration = 3500) {
  ensureContainer();

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-8 opacity-0 text-sm font-medium border ${getToastStyles(type)}`;

  const iconClass = getToastIcon(type);

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} text-lg flex-shrink-0"></i>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button class="toast-close-btn text-xs opacity-60 hover:opacity-100 transition-opacity ml-2" aria-label="Bildirimi kapat">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  // Attach close handler in JS instead of inline onclick (keeps CSP script-src free of 'unsafe-inline')
  toast.querySelector('.toast-close-btn')?.addEventListener('click', () => toast.remove());

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-8', 'opacity-0');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('translate-y-8', 'opacity-0');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, duration);
}

function getToastStyles(type) {
  switch (type) {
    case 'success':
      return 'bg-emerald-900/90 text-emerald-100 border-emerald-700/50';
    case 'error':
      return 'bg-rose-900/90 text-rose-100 border-rose-700/50';
    case 'warning':
      return 'bg-amber-900/90 text-amber-100 border-amber-700/50';
    case 'info':
    default:
      return 'bg-slate-900/90 text-slate-100 border-slate-700/50';
  }
}

function getToastIcon(type) {
  switch (type) {
    case 'success': return 'fa-circle-check text-emerald-400';
    case 'error': return 'fa-circle-xmark text-rose-400';
    case 'warning': return 'fa-triangle-exclamation text-amber-400';
    case 'info':
    default: return 'fa-circle-info text-teal-400';
  }
}
