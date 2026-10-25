// Storage adapter (D13 Steam reservation).
// ALL persistence in this game goes through this one interface.
// v1 backend: localStorage. Later backends (file saves, Steam Cloud)
// only need to reimplement these four methods; game logic must never
// touch localStorage, window, or any other browser-only API directly.
'use strict';

const StorageAdapter = {
  key: 'project-snooze-save-v1',

  // Returns the parsed save object, or null when there is none / it is corrupt.
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  // Persists a plain JSON-able object. Returns true on success.
  save(state) {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) { /* ignore */ }
  },
};
