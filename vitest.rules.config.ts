import { defineConfig } from 'vitest/config';

// Security-rules tests. They need the Firestore emulator, so run them with:
//   npm run test:rules
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.rules.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
