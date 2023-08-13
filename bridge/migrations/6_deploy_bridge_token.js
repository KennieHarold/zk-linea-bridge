require('dotenv').config({ path: '../.env' });
const BridgeToken = artifacts.require('BridgeToken');

module.exports = function (deployer) {
  return deployer.then(async () => {
    const bridgeToken = await deployer.deploy(BridgeToken);
    console.log('BridgeToken address', bridgeToken.address);
  });
};
