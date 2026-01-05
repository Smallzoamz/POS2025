import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pos.system2025',
  appName: 'POS 2025',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.106:5173',
    cleartext: true
  }
};

export default config;
