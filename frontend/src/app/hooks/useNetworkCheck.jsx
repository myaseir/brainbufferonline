import { useState, useCallback } from 'react';

export const useNetworkCheck = () => {
  const [latency, setLatency] = useState(null);
  const [status, setStatus] = useState('idle'); 

  // ✅ Use Google's lightweight 204 endpoint
  // This is fast, reliable, and won't spam your backend logs.
  const PING_URL = 'https://clients3.google.com/generate_204';

  // 1. SIMPLE PING (For Navbar visual)
  const checkPing = useCallback(async () => {
    try {
      const start = Date.now();
      
      // mode: 'no-cors' allows us to measure the round-trip time 
      // without needing the server to explicitly allow our origin.
      await fetch(PING_URL, { mode: 'no-cors', cache: 'no-store' });
      
      const ping = Date.now() - start;
      setLatency(ping);
      return ping < 300;
    } catch (err) {
      setLatency(999);
      return false; 
    }
  }, []);

  // 2. STABILITY TEST (For Ranked Entry)
  const measureStability = useCallback(async () => {
    setStatus('checking');
    let totalPing = 0;
    let failedPings = 0;
    const samples = 5; // We will ping 5 times

    // Run 5 checks in sequence
    for (let i = 0; i < samples; i++) {
      try {
        const start = Date.now();
        await fetch(PING_URL, { mode: 'no-cors', cache: 'no-store' });
        const ping = Date.now() - start;
        
        totalPing += ping;
        
        // 🚨 Immediate Fail: If ONE spike is huge (> 500ms), fail immediately
        if (ping > 500) {
            console.warn(`Stability Test Failed: Spike detected (${ping}ms)`);
            failedPings++;
        }
        
        // Small delay between pings to mimic real gameplay packets
        await new Promise(r => setTimeout(r, 200)); 

      } catch (e) {
        failedPings++;
      }
    }

    const avgPing = totalPing / samples;
    setStatus('idle');

    // 🧠 THE VERDICT
    // Fail if: Average is slow (>300) OR We had any failed/huge spikes
    if (avgPing > 300 || failedPings > 0) {
        return { passed: false, avg: Math.round(avgPing), spikes: failedPings };
    }
    
    return { passed: true, avg: Math.round(avgPing) };

  }, []);

  return { latency, status, checkPing, measureStability };
};