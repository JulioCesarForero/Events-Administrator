import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/components/staff/{VenueStep,LayoutStep,EventConfigStep}.tsx'], // We focus on the wizard for this milestone
      thresholds: {
        statements: 90,
        branches: 70,
        functions: 85,
        lines: 90
      }
    }
  }
});
