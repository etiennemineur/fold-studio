import React from 'react';

let patched = false;

export function r3fCompat() {
  if (patched) return;
  patched = true;
  
  // @ts-expect-error accessing internal API for compatibility patch
  const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (!internals) return;
  
  let _aValue = internals.A;
  
  Object.defineProperty(internals, 'A', {
    get() {
      return _aValue;
    },
    set(newVal: any) {
      if (newVal !== null && typeof newVal === 'object' && typeof newVal.getOwner !== 'function') {
        newVal.getOwner = function() { return null; };
      }
      _aValue = newVal;
    },
    configurable: true,
    enumerable: true
  });
}

// Auto-execute on import
r3fCompat();