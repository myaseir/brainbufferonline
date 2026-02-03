import { useCallback } from 'react';

export const useGameGeneration = () => {
  
  const generatePositions = useCallback((count) => {
    const newPositions = [];
    const safetyRadius = 16; 
    
    for (let i = 0; i < count; i++) {
      let position, attempts = 0, overlaps = true;
      // Try 1000 times to find a non-overlapping spot
      while (overlaps && attempts < 1000) { 
        attempts++;
        const left = 10 + Math.random() * 80; 
        const top = 10 + Math.random() * 80; 

        const hasCollision = newPositions.some(pos => {
          const dx = pos.left - left;
          const dy = (pos.top - top) * 1.2; 
          const distance = Math.sqrt(dx*dx + dy*dy);
          return distance < safetyRadius; 
        });

        if (!hasCollision) {
          position = { left, top };
          overlaps = false;
        }
      }
      if (position) newPositions.push(position);
      else newPositions.push({ left: 50, top: 50 }); // Fallback
    }
    return newPositions;
  }, []);

  const generateNumbers = useCallback((count) => {
    const nums = new Set();
    while (nums.size < count) nums.add(Math.floor(Math.random() * 20) + 1);
    return Array.from(nums);
  }, []);

  return { generatePositions, generateNumbers };
};