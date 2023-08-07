// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ZKProofVerifier.sol";
import "./interface/ITokenForgeable.sol";
import "./interface/IVerifier.sol";

error ZKLineaBridgeForge__TokenNotWhitelisted();
error ZKLineaBridgeForge__NotEnoughTokens();
error ZKLineaBridgeForge__TransferFailed();
error ZKLineaBridgeForge__TransferAlreadyProcessed();
error ZKLineaBridgeForge__TokenAlreadyWhitelisted();
error ZKLineaBridgeForge__InvalidProof();

contract ZKLineaBridgeForge is ZKProofVerifier, Ownable {
    uint256 nonce;

    mapping(ITokenForgeable => bool) whitelistedTokens;
    mapping(uint256 => bool) nonces;

    event Burn(address indexed _account, ITokenForgeable indexed _token, uint256 _amount);
    event Mint(address indexed _recipient, ITokenForgeable indexed _token, uint256 _amount);
    event WhitelistToken(ITokenForgeable indexed _token);

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) ZKProofVerifier(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

    function burn(ITokenForgeable _token, address _account, uint256 _amount) external {
        if (!whitelistedTokens[_token]) {
            revert ZKLineaBridgeForge__TokenNotWhitelisted();
        }
        uint256 accountBalance = _token.balanceOf(_msgSender());
        if (accountBalance < _amount) {
            revert ZKLineaBridgeForge__NotEnoughTokens();
        }
        _token.burn(_account, _amount);
        nonce++;
        emit Burn(_account, _token, _amount);
    }

    function mint(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        ITokenForgeable _token,
        address _recipient,
        uint256 _amount,
        uint256 _nonce,
        bytes32 _root,
        bytes32 _nullifierHash
    ) external {
        if (nonces[_nonce]) {
            revert ZKLineaBridgeForge__TransferAlreadyProcessed();
        }
        bool verify = _verifyWithdrawal(a, b, c, input, _root, _nullifierHash);
        if (!verify) {
            revert ZKLineaBridgeForge__InvalidProof();
        }
        nonces[_nonce] = true;
        _token.mint(_recipient, _amount);
        emit Mint(_recipient, _token, _amount);
    }

    function whitelistToken(ITokenForgeable _token) external onlyOwner {
        if (whitelistedTokens[_token]) {
            revert ZKLineaBridgeForge__TokenAlreadyWhitelisted();
        }
        whitelistedTokens[_token] = true;
        emit WhitelistToken(_token);
    }
}
