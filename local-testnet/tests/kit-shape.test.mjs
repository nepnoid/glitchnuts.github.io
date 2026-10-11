import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const kitDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('isolated local testnet package exposes a verification command', () => {
  const packagePath = path.join(kitDir, 'package.json');
  assert.equal(fs.existsSync(packagePath), true, 'local-testnet/package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.equal(typeof pkg.scripts?.verify, 'string', 'npm run verify must be available');
  assert.equal(typeof pkg.scripts?.start, 'string', 'npm start must launch the local chain, deploy if needed, and faucet');
});
