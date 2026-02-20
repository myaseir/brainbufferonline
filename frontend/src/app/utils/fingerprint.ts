import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getDeviceIdentifier = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Persistent Tie-Breaker (LocalStorage)
    // This creates a random ID on the first visit to prevent hardware collisions
    let localId = localStorage.getItem('_bb_id');
    if (!localId) {
      localId = crypto.randomUUID();
      localStorage.setItem('_bb_id', localId);
    }

    // 2. Browser Fingerprint Logic
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const components = result.components;

    const getSafeValue = (component: any) => 
      component && 'value' in component ? component.value : 'unknown';

    const stableData = {
      canvas: JSON.stringify(getSafeValue(components.canvas)),
      audio: JSON.stringify(getSafeValue(components.audio)),
      platform: getSafeValue(components.platform),
      hardware: getSafeValue(components.hardwareConcurrency),
      fonts: JSON.stringify(getSafeValue(components.fonts)),
      vendor: getSafeValue(components.vendor),
      // Adding the localId into the hash makes it nearly impossible 
      // for two different browsers to have the same ID.
      tid: localId 
    };

    return await hashString(JSON.stringify(stableData));

  } catch (error) {
    console.error("Web Security - Identifier failed:", error);
    return null;
  }
};

// SHA-256 Hashing Utility
async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}