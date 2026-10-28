import { describe, expect, it } from 'vitest';
import { callsPageCache, clearCallsCache, getSessionGeneration, setCallsPageCache } from './callsCache';

// Regression for R04: a request already in flight when logout happens used to
// still land afterward and write the previous account's data back into these
// module-level caches. clearCallsCache() now bumps a generation counter so a
// caller that captured the generation before firing its request can detect
// the session changed and discard the late response instead of applying it.

describe('callsCache session generation', () => {
  it('clearCallsCache bumps the generation', () => {
    const before = getSessionGeneration();
    clearCallsCache();
    expect(getSessionGeneration()).not.toBe(before);
  });

  it('a write guarded by the generation check is skipped once logout has happened', () => {
    const requestedGeneration = getSessionGeneration();
    clearCallsCache(); // logout happens while the "request" is still in flight

    // this is exactly the pattern fetchCalls uses in Calls.jsx
    if (getSessionGeneration() === requestedGeneration) {
      setCallsPageCache({ payload: { items: ['stale-account-data'] } });
    }

    expect(callsPageCache).toBeNull();
  });

  it('a write still succeeds when the session has not changed', () => {
    const requestedGeneration = getSessionGeneration();

    if (getSessionGeneration() === requestedGeneration) {
      setCallsPageCache({ payload: { items: ['fresh'] } });
    }

    expect(callsPageCache).toEqual({ payload: { items: ['fresh'] } });
  });
});
