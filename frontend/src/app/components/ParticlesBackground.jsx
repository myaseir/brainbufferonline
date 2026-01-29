"use client";

import { useState, useEffect } from 'react';
import styles from './BubbleGame.module.css';

export default function ParticlesBackground() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generate particles only on the client to avoid Next.js hydration mismatch
    const newParticles = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,      // Random horizontal start
      top: Math.random() * 100,       // Random vertical start
      delay: Math.random() * 5,       // Random start delay (0-5s)
      duration: 10 + Math.random() * 10, // Random speed (10s-20s float time)
      size: 10 + Math.random() * 20   // Random size (10px-30px)
    }));
    
    setParticles(newParticles);
    // No manual cleanup needed! React handles unmounting.
  }, []);

  return (
    <div className={styles.particleBackground}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={styles.particle}
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s` // Makes some float faster than others
          }}
        />
      ))}
    </div>
  );
}