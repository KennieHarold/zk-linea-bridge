// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BridgeToken is ERC20 {
    constructor() ERC20("BridgeToken", "BT") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

    function burn(address _owner, uint256 _amount) external {
        _burn(_owner, _amount);
    }
}
