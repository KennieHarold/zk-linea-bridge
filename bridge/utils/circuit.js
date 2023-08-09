const crypto = require('crypto');
const groth16 = require('snarkjs').groth16;
const circomlib = require('circomlib');

function toFixedHex(number, length = 32) {
  const str = BigInt(number).toString(16);
  return '0x' + str.padStart(length * 2, '0');
}

function rbuffer(nbytes) {
  return crypto.randomBytes(nbytes);
}

function pedersenHash(data) {
  return circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0];
}

async function genProofArgs(proof, pub) {
  proof = unStringifyBigInts(proof);
  pub = unStringifyBigInts(pub);
  const calldata = await groth16.exportSolidityCallData(proof, pub);
  const args = JSON.parse('[' + calldata + ']');
  return args;
}

function unStringifyBigInts(o) {
  if (typeof o == 'string' && /^[0-9]+$/.test(o)) {
    return BigInt(o);
  } else if (Array.isArray(o)) {
    return o.map(unStringifyBigInts);
  } else if (typeof o == 'object') {
    const res = {};
    const keys = Object.keys(o);
    keys.forEach((k) => {
      res[k] = unStringifyBigInts(o[k]);
    });
    return res;
  } else {
    return o;
  }
}

function toBigIntLE(buf) {
  const reversed = Buffer.from(buf);
  reversed.reverse();
  const hex = reversed.toString('hex');
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

module.exports = {
  toFixedHex,
  genProofArgs,
  unStringifyBigInts,
  toBigIntLE,
  rbuffer,
  pedersenHash,
  groth16
};
