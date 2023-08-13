// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ZKProofVerifier.sol";
import "./interface/IVerifier.sol";

error ZKLineaBridgeVault__TokenNotWhitelisted();
error ZKLineaBridgeVault__NotEnoughTokens();
error ZKLineaBridgeVault__TransferFailed();
error ZKLineaBridgeVault__TransferAlreadyProcessed();
error ZKLineaBridgeVault__InsufficientContractBalance();
error ZKLineaBridgeVault__TokenAlreadyWhitelisted();
error ZKLineaBridgeVault__InvalidProof();

contract ZKLineaBridgeVault is ZKProofVerifier, Ownable {
    uint256 public nonce;

    mapping(IERC20 => bool) whitelistedTokens;
    mapping(uint256 => bool) nonces;

    event Locked(bytes32 indexed _commitment, address indexed _account, IERC20 _token, uint256 _amount, uint256 _nonce);
    event Unlocked(address indexed _recipient, IERC20 _token, uint256 _amount);
    event WhitelistToken(IERC20 indexed _token);

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) ZKProofVerifier(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

    function lock(bytes32 _commitment, IERC20 _token, uint256 _amount) external {
        if (!whitelistedTokens[_token]) {
            revert ZKLineaBridgeVault__TokenNotWhitelisted();
        }
        uint256 accountBalance = _token.balanceOf(_msgSender());
        if (accountBalance < _amount) {
            revert ZKLineaBridgeVault__NotEnoughTokens();
        }
        bool success = _token.transferFrom(_msgSender(), address(this), _amount);
        if (!success) {
            revert ZKLineaBridgeVault__TransferFailed();
        }
        emit Locked(_commitment, _msgSender(), _token, _amount, nonce);
        nonce++;
    }

    function unlock(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        bytes32 _root,
        bytes32 _nullifierHash,
        IERC20 _token,
        uint256 _amount,
        uint256 _nonce
    ) external {
        if (!whitelistedTokens[_token]) {
            revert ZKLineaBridgeVault__TokenNotWhitelisted();
        }
        if (nonces[_nonce]) {
            revert ZKLineaBridgeVault__TransferAlreadyProcessed();
        }
        uint256 vaultBalance = _token.balanceOf(address(this));
        if (vaultBalance < _amount) {
            revert ZKLineaBridgeVault__InsufficientContractBalance();
        }
        bool verify = _verifyWithdrawal(a, b, c, input, _root, _nullifierHash);
        if (!verify) {
            revert ZKLineaBridgeVault__InvalidProof();
        }
        nonces[_nonce] = true;
        _token.transfer(_msgSender(), _amount);
        emit Unlocked(_msgSender(), _token, _amount);
    }

    function whitelistToken(IERC20 _token) external onlyOwner {
        if (whitelistedTokens[_token]) {
            revert ZKLineaBridgeVault__TokenAlreadyWhitelisted();
        }
        whitelistedTokens[_token] = true;
        emit WhitelistToken(_token);
    }

    function isWhitelistedToken(IERC20 _token) external view returns (bool) {
        return whitelistedTokens[_token];
    }

    function isNonceAlreadyProcessed(uint256 _nonce) external view returns (bool) {
        return nonces[_nonce];
    }
}
