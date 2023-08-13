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
    uint256 public nonce;

    mapping(ITokenForgeable => bool) whitelistedTokens;
    mapping(uint256 => bool) nonces;

    event Burn(
        bytes32 indexed _commitment,
        address indexed _account,
        ITokenForgeable _token,
        uint256 _amount,
        uint256 _nonce
    );
    event Mint(address indexed _recipient, ITokenForgeable _token, uint256 _amount);
    event WhitelistToken(ITokenForgeable indexed _token);

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) ZKProofVerifier(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

    function burn(bytes32 _commitment, ITokenForgeable _token, uint256 _amount) external {
        if (!whitelistedTokens[_token]) {
            revert ZKLineaBridgeForge__TokenNotWhitelisted();
        }
        uint256 accountBalance = _token.balanceOf(_msgSender());
        if (accountBalance < _amount) {
            revert ZKLineaBridgeForge__NotEnoughTokens();
        }
        _token.burn(_msgSender(), _amount);
        emit Burn(_commitment, _msgSender(), _token, _amount, nonce);
        nonce++;
    }

    function mint(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        bytes32 _root,
        bytes32 _nullifierHash,
        ITokenForgeable _token,
        uint256 _amount,
        uint256 _nonce
    ) external {
        if (!whitelistedTokens[_token]) {
            revert ZKLineaBridgeForge__TokenNotWhitelisted();
        }
        if (nonces[_nonce]) {
            revert ZKLineaBridgeForge__TransferAlreadyProcessed();
        }
        bool verify = _verifyWithdrawal(a, b, c, input, _root, _nullifierHash);
        if (!verify) {
            revert ZKLineaBridgeForge__InvalidProof();
        }
        nonces[_nonce] = true;
        _token.mint(_msgSender(), _amount);
        emit Mint(_msgSender(), _token, _amount);
    }

    function whitelistToken(ITokenForgeable _token) external onlyOwner {
        if (whitelistedTokens[_token]) {
            revert ZKLineaBridgeForge__TokenAlreadyWhitelisted();
        }
        whitelistedTokens[_token] = true;
        emit WhitelistToken(_token);
    }

    function isWhitelistedToken(ITokenForgeable _token) external view returns (bool) {
        return whitelistedTokens[_token];
    }

    function isNonceAlreadyProcessed(uint256 _nonce) external view returns (bool) {
        return nonces[_nonce];
    }
}
