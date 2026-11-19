/** Unit and component tests. Emulator tests use jest.emulator.config.js. */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/tests/component/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFiles: ['<rootDir>/tests/setup/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/functions/'],
};
