module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  // Stale agent worktrees under .claude/ carry their own __tests__ copies —
  // never run them as part of this repo's suite.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.next/'],
};
