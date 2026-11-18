/**
 * Runs the Cloud Functions unit tests, then repeats the client/server parity test in several
 * time zones. Each zone needs its own process because Node fixes the zone at start-up.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// npm scripts run from the project root.
const jest = path.resolve('node_modules', '.bin', 'jest');
const run = (args, env = {}) => {
  const result = spawnSync(jest, ['-c', 'jest.functions.config.js', '--ci', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run([]);
for (const zone of [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Kolkata',
  'Australia/Sydney',
]) {
  console.log(`\nParity check in ${zone}`);
  run(['-t', 'client/server parity', '--silent'], { TZ: zone });
}
