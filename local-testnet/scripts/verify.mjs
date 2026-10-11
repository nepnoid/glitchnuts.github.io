import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['--test', 'tests/**/*.test.mjs'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});
child.on('error', () => { process.exitCode = 1; });
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
