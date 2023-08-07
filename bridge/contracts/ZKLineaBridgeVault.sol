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
    uint256 nonce;

    mapping(IERC20 => bool) whitelistedTokens;
    mapping(uint256 => bool) nonces;

    event Locked(address indexed _account, IERC20 indexed _token, uint256 _amount);
    event Unlocked(address indexed _recipient, IERC20 indexed _token, uint256 _amount);
    event WhitelistToken(IERC20 indexed _token);

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight
    ) ZKProofVerifier(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

    function lock(IERC20 _token, address _account, uint256 _amount) external {
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
        nonce++;
        emit Locked(_account, _token, _amount);
    }

    function unlock(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input,
        IERC20 _token,
        address _recipient,
        uint256 _amount,
        uint256 _nonce,
        bytes32 _root,
        bytes32 _nullifierHash
    ) external {
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
        _token.transfer(_recipient, _amount);
        emit Unlocked(_recipient, _token, _amount);
    }

    function whitelistToken(IERC20 _token) external onlyOwner {
        if (whitelistedTokens[_token]) {
            revert ZKLineaBridgeVault__TokenAlreadyWhitelisted();
        }
        whitelistedTokens[_token] = true;
        emit WhitelistToken(_token);
    }
}
