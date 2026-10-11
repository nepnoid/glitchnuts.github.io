import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const contractPath = path.resolve(new URL('../../contracts/GNC.sol', import.meta.url).pathname);

export function compileGnc() {
  const source = fs.readFileSync(contractPath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'GNC.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? [];
  if (errors.length) throw new Error('GNC compilation failed');
  const artifact = output.contracts?.['GNC.sol']?.GNC;
  if (!artifact?.evm?.bytecode?.object) throw new Error('GNC compiler emitted no deployable bytecode');
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}
