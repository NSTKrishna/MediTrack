/** Unit tests for Cloud Functions logic (pure TypeScript, no emulator needed). */
module.exports = {
  preset: 'jest-expo/node',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/functions/src/**/*.test.ts'],
  testPathIgnorePatterns: ['\\.emulator\\.test\\.ts$'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  modulePathIgnorePatterns: ['<rootDir>/functions/lib/'],
};
