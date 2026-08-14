import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast } from '../../src/js/components/toast.js';

// jsdom doesn't implement requestAnimationFrame; toast.js uses it purely to trigger the
// enter-animation CSS transition, so a synchronous stub is enough for these tests.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb) => cb());
  vi.useFakeTimers();
});

afterEach(() => {
  // toast.js keeps a module-level singleton container across calls — remove only the
  // individual toasts it rendered, not the container itself, so the module's internal
  // `toastContainer` reference (captured on the container's first creation) stays valid
  // for the next test instead of pointing at a node we just ripped out of the document.
  document.querySelectorAll('.fixed.bottom-6 > div').forEach((el) => el.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('showToast', () => {
  it('renders the message text into a toast appended to the document', () => {
    showToast('Konum bulundu.', 'success');

    const toast = document.querySelector('.fixed.bottom-6 > div');
    expect(toast?.textContent).toContain('Konum bulundu.');
  });

  it('escapes HTML in the message to prevent XSS', () => {
    showToast('<img src=x onerror=alert(1)>', 'error');

    const toast = document.querySelector('.fixed.bottom-6 > div');
    expect(toast.innerHTML).not.toContain('<img');
    expect(toast.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('gives the close button an accessible name', () => {
    showToast('Bilgi mesajı.', 'info');

    const closeBtn = document.querySelector('.toast-close-btn');
    expect(closeBtn?.getAttribute('aria-label')).toBeTruthy();
  });

  it('removes the toast when its close button is clicked', () => {
    showToast('Kapatılabilir mesaj.', 'warning');

    const closeBtn = document.querySelector('.toast-close-btn');
    closeBtn.click();

    expect(document.querySelector('.fixed.bottom-6 > div')).toBeNull();
  });

  it('auto-dismisses after the given duration', () => {
    showToast('Otomatik kapanır.', 'info', 1000);
    expect(document.querySelector('.fixed.bottom-6 > div')).not.toBeNull();

    vi.advanceTimersByTime(1000 + 300 + 1);

    expect(document.querySelector('.fixed.bottom-6 > div')).toBeNull();
  });

  it('reuses a single toast container across multiple calls', () => {
    showToast('Birinci', 'info');
    showToast('İkinci', 'success');

    expect(document.querySelectorAll('.fixed.bottom-6').length).toBe(1);
    expect(document.querySelectorAll('.fixed.bottom-6 > div').length).toBe(2);
  });
});
