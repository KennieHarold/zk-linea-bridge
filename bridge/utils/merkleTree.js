const circomlib = require('circomlib');
const mimcsponge = circomlib.mimcsponge;

function MiMCSponge(left, right) {
  return mimcsponge.multiHash([BigInt(left), BigInt(right)]).toString();
}

class MerkleTree {
  constructor(levels, defaultLeaves = [], hashLeftRight = MiMCSponge) {
    this.zeroValue =
      '21663839004416932945382355908790599225266501822907911457504978515578255421292';

    this.levels = levels;
    this.hashLeftRight = hashLeftRight;
    this.storage = new Map();
    this.zeros = [];
    this.totalLeaves = 0;

    // build zeros depends on tree levels
    let currentZero = this.zeroValue;
    this.zeros.push(currentZero);
    for (let i = 0; i < levels; i++) {
      currentZero = this.hashLeftRight(currentZero, currentZero);
      this.zeros.push(currentZero);
    }

    if (defaultLeaves.length > 0) {
      this.totalLeaves = defaultLeaves.length;

      // store leaves with key value pair
      let level = 0;
      defaultLeaves.forEach((leaf, index) => {
        this.storage.set(MerkleTree.indexToKey(level, index), leaf);
      });

      // build tree with initial leaves
      level++;
      let numberOfNodesInLevel = Math.ceil(this.totalLeaves / 2);
      for (level; level <= this.levels; level++) {
        for (let i = 0; i < numberOfNodesInLevel; i++) {
          const leftKey = MerkleTree.indexToKey(level - 1, 2 * i);
          const rightKey = MerkleTree.indexToKey(level - 1, 2 * i + 1);

          const left = this.storage.get(leftKey);
          const right = this.storage.get(rightKey) || this.zeros[level - 1];
          if (!left) throw new Error('leftKey not found');

          const node = this.hashLeftRight(left, right);
          this.storage.set(MerkleTree.indexToKey(level, i), node);
        }
        numberOfNodesInLevel = Math.ceil(numberOfNodesInLevel / 2);
      }
    }
  }

  static indexToKey(level, index) {
    return `${level}-${index}`;
  }

  getIndex(leaf) {
    for (const [key, value] of this.storage) {
      if (value === leaf) {
        return Number(key.split('-')[1]);
      }
    }
    return -1;
  }

  root() {
    return this.storage.get(MerkleTree.indexToKey(this.levels, 0)) || this.zeros[this.levels];
  }

  proof(indexOfLeaf) {
    let pathElements = [];
    let pathIndices = [];

    const leaf = this.storage.get(MerkleTree.indexToKey(0, indexOfLeaf));
    if (!leaf) throw new Error('leaf not found');

    const handleIndex = (level, currentIndex, siblingIndex) => {
      const siblingValue =
        this.storage.get(MerkleTree.indexToKey(level, siblingIndex)) || this.zeros[level];
      pathElements.push(siblingValue);
      pathIndices.push(currentIndex % 2);
    };

    this.traverse(indexOfLeaf, handleIndex);

    return {
      root: this.root(),
      pathElements,
      pathIndices,
      leaf: leaf
    };
  }

  insert(leaf) {
    const index = this.totalLeaves;
    this.update(index, leaf, true);
    this.totalLeaves++;
  }

  update(index, newLeaf, isInsert = false) {
    if (!isInsert && index >= this.totalLeaves) {
      throw Error('Use insert method for new elements.');
    } else if (isInsert && index < this.totalLeaves) {
      throw Error('Use update method for existing elements.');
    }

    let keyValueToStore = [];
    let currentElement = newLeaf;

    const handleIndex = (level, currentIndex, siblingIndex) => {
      const siblingElement =
        this.storage.get(MerkleTree.indexToKey(level, siblingIndex)) || this.zeros[level];

      let left;
      let right;
      if (currentIndex % 2 === 0) {
        left = currentElement;
        right = siblingElement;
      } else {
        left = siblingElement;
        right = currentElement;
      }

      keyValueToStore.push({
        key: MerkleTree.indexToKey(level, currentIndex),
        value: currentElement
      });
      currentElement = this.hashLeftRight(left, right);
    };

    this.traverse(index, handleIndex);

    // push root to the end
    keyValueToStore.push({
      key: MerkleTree.indexToKey(this.levels, 0),
      value: currentElement
    });

    keyValueToStore.forEach((o) => {
      this.storage.set(o.key, o.value);
    });
  }

  // traverse from leaf to root with handler for target node and sibling node
  traverse(indexOfLeaf, handler) {
    let currentIndex = indexOfLeaf;
    for (let i = 0; i < this.levels; i++) {
      let siblingIndex;
      if (currentIndex % 2 === 0) {
        siblingIndex = currentIndex + 1;
      } else {
        siblingIndex = currentIndex - 1;
      }

      handler(i, currentIndex, siblingIndex);
      currentIndex = Math.floor(currentIndex / 2);
    }
  }
}

module.exports = {
  MiMCSponge,
  MerkleTree
};
