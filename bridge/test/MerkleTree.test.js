require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should();
const MerkleTree = artifacts.require('./MerkleTreeMock.sol');
const hasherContract = artifacts.require('./Hasher.sol');
const { MerkleTree: MerkleTreeUtil } = require('../utils/merkleTree');

const { MERKLE_TREE_HEIGHT } = process.env;

function toFixedHex(number, length = 32) {
  const str = BigInt(number).toString(16);
  return '0x' + str.padStart(length * 2, '0');
}

contract('MerkleTree', (accounts) => {
  let merkleTree;
  let hasherInstance;
  let levels = MERKLE_TREE_HEIGHT || 16;
  const sender = accounts[0];
  let tree;

  before(async () => {
    tree = new MerkleTreeUtil(levels);
    hasherInstance = await hasherContract.deployed();
    merkleTree = await MerkleTree.new(levels, hasherInstance.address);
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      const zeroValue = await merkleTree.ZERO_VALUE();
      const firstSubtree = await merkleTree.filledSubtrees(0);
      firstSubtree.should.be.equal(toFixedHex(zeroValue));
      const firstZero = await merkleTree.zeros(0);
      firstZero.should.be.equal(toFixedHex(zeroValue));
    });
  });

  describe('#insert', () => {
    it('should insert', async () => {
      let rootFromContract;
      for (let i = 1; i < 11; i++) {
        await merkleTree.insert(toFixedHex(i), { from: sender });
        tree.insert(i);
        rootFromContract = await merkleTree.getLastRoot();
        toFixedHex(tree.root()).should.be.equal(rootFromContract.toString());
      }
    });

    it('should reject if tree is full', async () => {
      const levels = 6;
      const merkleTree = await MerkleTree.new(levels, hasherInstance.address);

      for (let i = 0; i < 2 ** levels; i++) {
        await merkleTree.insert(toFixedHex(i + 42)).should.be.fulfilled;
      }

      let error = await merkleTree.insert(toFixedHex(1337)).should.be.rejected;
      error = await merkleTree.insert(toFixedHex(1)).should.be.rejected;
    });
  });

  describe('#isKnownRoot', () => {
    it('should work', async () => {
      for (let i = 1; i < 5; i++) {
        await merkleTree.insert(toFixedHex(i), { from: sender }).should.be.fulfilled;
        await tree.insert(i);
        let isKnown = await merkleTree.isKnownRoot(toFixedHex(tree.root()));
        isKnown.should.be.equal(true);
      }

      await merkleTree.insert(toFixedHex(42), { from: sender }).should.be.fulfilled;
      let isKnown = await merkleTree.isKnownRoot(toFixedHex(tree.root()));
      isKnown.should.be.equal(true);
    });

    it('should not return uninitialized roots', async () => {
      await merkleTree.insert(toFixedHex(42), { from: sender }).should.be.fulfilled;
      let isKnown = await merkleTree.isKnownRoot(toFixedHex(0));
      isKnown.should.be.equal(false);
    });
  });
});
