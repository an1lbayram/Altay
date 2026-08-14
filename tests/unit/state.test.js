import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state } from '../../src/js/state.js';

// `state` is a singleton module export, so reset the bits each test touches to avoid
// cross-test leakage (it's a module-level object, not re-instantiated per test file).
beforeEach(() => {
  state.listeners.clear();
  state.category = 'all';
  state.radius = 5;
  state.pois = [];
});

describe('state.subscribe / notify', () => {
  it('calls subscribed listeners with (key, value, state) on set()', () => {
    const listener = vi.fn();
    state.subscribe(listener);

    state.set('radius', 10);

    expect(listener).toHaveBeenCalledWith('radius', 10, state);
  });

  it('does not notify when setting the same value again', () => {
    state.radius = 10;
    const listener = vi.fn();
    state.subscribe(listener);

    state.set('radius', 10);

    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple independent listeners', () => {
    const a = vi.fn();
    const b = vi.fn();
    state.subscribe(a);
    state.subscribe(b);

    state.set('category', 'museum');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe() (the function returned by subscribe) stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    unsubscribe();
    state.set('category', 'castle');

    expect(listener).not.toHaveBeenCalled();
  });

  it('actually mutates the underlying property', () => {
    state.set('pois', [{ id: '1' }]);
    expect(state.pois).toEqual([{ id: '1' }]);
  });
});
