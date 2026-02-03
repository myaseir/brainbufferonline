import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brainbuffer.game',
  appName: 'BrainBuffer',
  webDir: 'out', // 👈 CHANGED FROM 'public' TO 'out'
  server: {
    androidScheme: 'https' // 👈 Helps avoid mixed content errors
  }
};

export default config;