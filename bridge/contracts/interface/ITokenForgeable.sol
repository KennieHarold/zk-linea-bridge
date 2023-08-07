// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITokenForgeable {
    function mint(address to, uint256 amount) external;

    function burn(address owner, uint256 amount) external;

    function balanceOf(address owner) external view returns (uint256);
}
