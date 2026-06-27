import hre from 'hardhat';

async function main() {
  const TrioTaskReceipts = await hre.ethers.getContractFactory('TrioTaskReceipts');
  const contract = await TrioTaskReceipts.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`TRIO_RECEIPT_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
