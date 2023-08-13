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

contract('ZKLineaBridgeVault', ([deployer, account, recipient]) => {
  let [bridgeToken, bridgeVault, bridgeForge] = [];

  beforeEach(async function () {
    const hasher = await hasherContract.deployed();
    const verifier = await verifierContract.deployed();

    bridgeVault = await bridgeVaultContract.new(verifier.address, hasher.address, value, levels);
    bridgeForge = await bridgeForgeContract.new(verifier.address, hasher.address, value, levels);
    bridgeToken = await bridgeTokenContract.deployed();
  });

  describe('#constructor', () => {
    it('should initialize ', async () => {
      (await bridgeVault.denomination()).toString().should.be.equal(value);
      (await bridgeForge.denomination()).toString().should.be.equal(value);
    });
  });

  describe('#lock', () => {
    it('should lock tokens', async () => {
      await bridgeVault.whitelistToken(bridgeToken.address).should.be.fulfilled;
      const isWhitelisted = await bridgeVault.isWhitelistedToken(bridgeToken.address);
      isWhitelisted.should.true;

      await bridgeToken.transfer(account, transferValue).should.be.fulfilled;
      const accountBalance = await bridgeToken.balanceOf(account);
      accountBalance.toString().should.equal(transferValue);

      await bridgeToken.approve(bridgeVault.address, transferValue, { from: account }).should.be
        .fulfilled;
      const accountAllowance = await bridgeToken.allowance(account, bridgeVault.address, {
        from: account
      });
      accountAllowance.toString().should.equal(transferValue);

      const commitment = toFixedHex(42);
      await bridgeVault.lock(commitment, bridgeToken.address, transferValue, { from: account })
        .should.be.fulfilled;

      const contractBalance = await bridgeToken.balanceOf(bridgeVault.address);
      contractBalance.toString().should.equal(transferValue);

      const newAccountBalance = await bridgeToken.balanceOf(account);
      newAccountBalance.toString().should.equal('0');

      const nonce = await bridgeVault.nonce();
      nonce.toString().should.equal('1');
    });
  });

  describe('#mint', () => {
    it('should mint tokens from other bridge contract', async () => {
      await bridgeForge.whitelistToken(bridgeToken.address).should.be.fulfilled;

      // We have to burn some test tokens first
      await bridgeForge.burn(toFixedHex(42), bridgeToken.address, transferValue, { from: deployer })
        .should.be.fulfilled;

      const randomBuf = rbuffer(31);
      const secret = toBigIntLE(randomBuf);
      const commitment = pedersenHash(randomBuf).toString();
      const tree = new MerkleTree(levels);

      tree.insert(commitment);
      const txResponse = await bridgeForge.addCommitment(toFixedHex(commitment)).should.be
        .fulfilled;
      const events = txResponse.logs?.filter((x) => {
        return x.event === 'AddCommitment';
      });
      const leafIndex = events[0].args.leafIndex;
      const merkleProof = tree.proof(leafIndex);

      const isKnownRoot = await bridgeForge.isKnownRoot(toFixedHex(tree.root()));
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

      await bridgeForge.mint(...proofArgs, ...args, { from: recipient });
      const isSpent = await bridgeForge.isSpent(toFixedHex(nullifierHash.toString()));
      isSpent.should.be.true;
    });
  });
});
