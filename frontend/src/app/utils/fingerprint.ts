import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getBrowserFingerprint = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();

    // 🛡️ THE STABILIZER
    const components = result.components;

    // Helper function to safely extract values from FingerprintJS components
    const getSafeValue = (component: any) => {
      return component && 'value' in component ? component.value : 'unknown';
    };

    const stableData = {
      canvas: JSON.stringify(getSafeValue(components.canvas)),
      audio: JSON.stringify(getSafeValue(components.audio)),
      platform: getSafeValue(components.platform),
      hardware: getSafeValue(components.hardwareConcurrency),
      fonts: JSON.stringify(getSafeValue(components.fonts)),
      vendor: getSafeValue(components.vendor),
    };

    // Convert our stable hardware object into a single string
    const stableString = JSON.stringify(stableData);
    
    // Hash it using the Web Crypto API
    const msgUint8 = new TextEncoder().encode(stableString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.substring(0, 32);
  } catch (error) {
    console.error("Brain Buffer Security - Stable Fingerprint failed:", error);
    return null;
  }
};