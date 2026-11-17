/**
 * Firestore security-rule, transaction, and Cloud Functions alert tests. These run against the
 * local Firestore emulator:   npm run test:emulator
 */
module.exports = {
  preset: 'jest-expo/node',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/emulator/**/*.test.ts',
    '<rootDir>/functions/src/**/*.emulator.test.ts',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  modulePathIgnorePatterns: ['<rootDir>/functions/lib/'],
  testTimeout: 30000,
  maxWorkers: 1,
};
