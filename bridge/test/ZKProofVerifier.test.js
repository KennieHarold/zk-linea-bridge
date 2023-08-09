require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should();
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
const zkProofVerifierContract = artifacts.require('./ZKProofVerifierMock.sol');
const hasherContract = artifacts.require('./Hasher.sol');

const wasmPath = path.join(__dirname, '../build/circuits/circuit.wasm');
const zKeyPath = path.join(__dirname, '../build/circuits/circuit_final.zkey');

const levels = Number(process.env.MERKLE_TREE_HEIGHT) || 20;
const value = process.env.ETH_AMOUNT || '1000000000000000000'; // 1 ether

contract('ZKProofVerifier', () => {
  let [hasher, verifier, zKProofVerifier] = [];

  beforeEach(async function () {
    hasher = await hasherContract.deployed();
    verifier = await verifierContract.deployed();
    zKProofVerifier = await zkProofVerifierContract.new(
      verifier.address,
      hasher.address,
      value,
      levels
    );
  });

  describe('#constructor', () => {
    it('should initialize ', async () => {
      (await zKProofVerifier.denomination()).toString().should.be.equal(value);
    });
  });

  describe('#addCommitment', () => {
    it('should add commitment', async () => {
      const commitment = toFixedHex(42);
      await zKProofVerifier.addCommitment(commitment).should.be.fulfilled;
    });

    it('should revert if there is a such commitment', async () => {
      const commitment = toFixedHex(42);
      await zKProofVerifier.addCommitment(commitment).should.be.fulfilled;
      await zKProofVerifier.addCommitment(commitment).should.be.rejected;
    });
  });

  describe('#verifyWithdrawal', () => {
    it('should work', async () => {
      const randomBuf = rbuffer(31);
      const secret = toBigIntLE(randomBuf);
      const commitment = pedersenHash(randomBuf).toString();
      const tree = new MerkleTree(levels);

      tree.insert(commitment);
      const txResponse = await zKProofVerifier.addCommitment(toFixedHex(commitment)).should.be
        .fulfilled;
      const events = txResponse.logs?.filter((x) => {
        return x.event === 'AddCommitment';
      });
      const leafIndex = events[0].args.leafIndex;
      const merkleProof = tree.proof(leafIndex);

      (await zKProofVerifier.isKnownRoot(toFixedHex(tree.root()))).should.be.true;

      const input = {
        secret: secret.toString(),
        root: tree.root(),
        pathElements: merkleProof.pathElements,
        pathIndices: merkleProof.pathIndices
      };

      const nullifierHash = secret;

      let { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zKeyPath);
      const proofArgs = await genProofArgs(proof, publicSignals);
      const args = [toFixedHex(tree.root()), toFixedHex(nullifierHash.toString())];

      await zKProofVerifier.verifyWithdrawal(...proofArgs, ...args);
      (await zKProofVerifier.isSpent(toFixedHex(nullifierHash.toString()))).should.be.true;
      await zKProofVerifier.verifyWithdrawal(...proofArgs, ...args).should.be.rejected;
    });
  });
});
