// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../ZKProofVerifier.sol";
import "../interface/IVerifier.sol";

contract ZKProofVerifierMock is ZKProofVerifier {
    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) ZKProofVerifier(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

    function verifyWithdrawal(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        bytes32 _root,
        bytes32 _nullifierHash
    ) external {
        _verifyWithdrawal(a, b, c, input, _root, _nullifierHash);
    }
}
