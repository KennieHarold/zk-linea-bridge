require('dotenv').config({ path: '../.env' });
const Bridge = artifacts.require('ZKLineaBridgeVault');
const Verifier = artifacts.require('Groth16Verifier');
const Hasher = artifacts.require('Hasher');

module.exports = function (deployer) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT, DENOMINATION } = process.env;
    const verifier = await Verifier.deployed();
    const hasher = await Hasher.deployed();
    const bridge = await deployer.deploy(
      Bridge,
      verifier.address,
      hasher.address,
      DENOMINATION || 100,
      MERKLE_TREE_HEIGHT || 16
    );
    console.log('ZKLineaBridgeVault address', bridge.address);
  });
};
