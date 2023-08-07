const Verifier = artifacts.require('Groth16Verifier');

module.exports = function (deployer) {
  deployer.deploy(Verifier);
};
