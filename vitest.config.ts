import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { VITE_TURNSTILE_SITE_KEY: 'test-site-key' },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**/*.ts']
    }
  }
});
