require('chai');
const path = require('path');

const { MerkleTree } = require('../utils/merkleTree');
const {
  toFixedHex,
  rbuffer,
  toBigIntLE,
  pedersenHash,
  genProofArgs,
  groth16
} = require('../utils/circuit');

const verifierContract = artifacts.require('./Groth16Verifier.sol');
const hasherContract = artifacts.require('./Hasher.sol');
const bridgeVaultContract = artifacts.require('./ZKLineaBridgeVault.sol');
const bridgeForgeContract = artifacts.require('./ZKLineaBridgeForge.sol');
const bridgeTokenContract = artifacts.require('./BridgeToken.sol');

const wasmPath = path.join(__dirname, '../build/circuits/circuit.wasm');
const zKeyPath = path.join(__dirname, '../build/circuits/circuit_final.zkey');

const levels = Number(process.env.MERKLE_TREE_HEIGHT) || 20;
const value = process.env.ETH_AMOUNT || '1000000000000000000'; // 1 ether
const transferValue = '100000000000000000000'; // 100 ethers

contract('ZKLineaBridgeForge', ([deployer, account, recipient]) => {
  let [bridgeToken, bridgeVault, bridgeForge] = [];

  beforeEach(async function () {
    const hasher = await hasherContract.deployed();
    const verifier = await verifierContract.deployed();

    bridgeForge = await bridgeForgeContract.new(verifier.address, hasher.address, value, levels);
    bridgeVault = await bridgeVaultContract.new(verifier.address, hasher.address, value, levels);
    bridgeToken = await bridgeTokenContract.deployed();
  });

  describe('#constructor', () => {
    it('should initialize ', async () => {
      (await bridgeForge.denomination()).toString().should.be.equal(value);
      (await bridgeVault.denomination()).toString().should.be.equal(value);
    });
  });

  describe('#burn', () => {
    it('should burn tokens', async () => {
      await bridgeForge.whitelistToken(bridgeToken.address).should.be.fulfilled;
      const isWhitelisted = await bridgeForge.isWhitelistedToken(bridgeToken.address);
      isWhitelisted.should.true;

      await bridgeToken.transfer(account, transferValue).should.be.fulfilled;
      const accountBalance = await bridgeToken.balanceOf(account);
      accountBalance.toString().should.equal(transferValue);

      const commitment = toFixedHex(42);
      await bridgeForge.burn(commitment, bridgeToken.address, transferValue, { from: account })
        .should.be.fulfilled;

      const newAccountBalance = await bridgeToken.balanceOf(account);
      newAccountBalance.toString().should.equal('0');

      const nonce = await bridgeForge.nonce();
      nonce.toString().should.equal('1');
    });

    it('should unlock tokens from other bridge contract', async () => {
      await bridgeVault.whitelistToken(bridgeToken.address).should.be.fulfilled;

      // We should lock test tokens first
      await bridgeToken.approve(bridgeVault.address, transferValue, { from: deployer }).should.be
        .fulfilled;
      await bridgeVault.lock(toFixedHex(42), bridgeToken.address, transferValue, { from: deployer })
        .should.be.fulfilled;

      const randomBuf = rbuffer(31);
      const secret = toBigIntLE(randomBuf);
      const commitment = pedersenHash(randomBuf).toString();
      const tree = new MerkleTree(levels);

      tree.insert(commitment);
      const txResponse = await bridgeVault.addCommitment(toFixedHex(commitment)).should.be
        .fulfilled;
      const events = txResponse.logs?.filter((x) => {
        return x.event === 'AddCommitment';
      });
      const leafIndex = events[0].args.leafIndex;
      const merkleProof = tree.proof(leafIndex);

      const isKnownRoot = await bridgeVault.isKnownRoot(toFixedHex(tree.root()));
      isKnownRoot.should.be.true;

      const input = {
        secret: secret.toString(),
        root: tree.root(),
        pathElements: merkleProof.pathElements,
        pathIndices: merkleProof.pathIndices
      };

      const nullifierHash = secret;

      let { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zKeyPath);
      const proofArgs = await genProofArgs(proof, publicSignals);
      const args = [
        toFixedHex(tree.root()),
        toFixedHex(nullifierHash.toString()),
        bridgeToken.address,
        transferValue,
        0
      ];

      await bridgeVault.unlock(...proofArgs, ...args, { from: recipient });
      const isSpent = await bridgeVault.isSpent(toFixedHex(nullifierHash.toString()));
      isSpent.should.be.true;
    });
  });
});
