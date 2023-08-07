// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MerkleTree.sol";
import "./interface/IVerifier.sol";

error ZKProofVerifier__InvalidDenomination();
error ZKProofVerifier__CommitmentAlreadySpent();
error ZKProofVerifier__NoteAlreadySpent();
error ZKProofVerifier__InvalidMerkleRoot();
error ZKProofVerifier__InvalidVerifierProof();

contract ZKProofVerifier is MerkleTree, ReentrancyGuard {
    IVerifier public immutable verifier;
    uint256 public denomination;

    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) MerkleTree(_merkleTreeHeight, _hasher) {
        if (_denomination < 1) {
            revert ZKProofVerifier__InvalidDenomination();
        }
        verifier = _verifier;
        denomination = _denomination;
    }

    function addCommitment(bytes32 _commitment) external nonReentrant {
        if (commitments[_commitment]) {
            revert ZKProofVerifier__CommitmentAlreadySpent();
        }
        _insert(_commitment);
        commitments[_commitment] = true;
    }

    function _verifyWithdrawal(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        bytes32 _root,
        bytes32 _nullifierHash
    ) internal nonReentrant returns (bool) {
        if (nullifierHashes[_nullifierHash]) {
            revert ZKProofVerifier__NoteAlreadySpent();
        }
        if (!isKnownRoot(_root)) {
            revert ZKProofVerifier__InvalidMerkleRoot();
        }
        bool verify = verifier.verifyProof(a, b, c, input);
        if (!verify) {
            revert ZKProofVerifier__InvalidVerifierProof();
        }
        nullifierHashes[_nullifierHash] = true;
        return true;
    }

    function isSpent(bytes32 _nullifierHash) public view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }
}
