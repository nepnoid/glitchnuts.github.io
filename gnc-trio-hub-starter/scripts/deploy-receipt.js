const hre = require('hardhat');

async function main() {
  const Factory = await hre.ethers.getContractFactory('TrioReceiptRegistry');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('TrioReceiptRegistry deployed to:', address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
