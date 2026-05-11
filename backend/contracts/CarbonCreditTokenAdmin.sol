// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./CarbonCreditToken.sol";

/// @title CarbonCreditTokenAdmin
/// @notice Testing/admin wrapper that exposes owner-only mint/burn for CCT
contract CarbonCreditTokenAdmin is CarbonCreditToken {
    event AdminMint(address indexed to, uint256 amount);
    event AdminBurn(address indexed from, uint256 amount);

    constructor(address registryAddress) CarbonCreditToken(registryAddress) {}

    /// @notice owner-only helper to mint tokens directly (test/admin tooling)
    function adminMint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero to");
        require(amount > 0, "amount=0");
        _mint(to, amount);
        emit AdminMint(to, amount);
    }

    /// @notice owner-only helper to burn tokens from a holder (test/admin tooling)
    function adminBurn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "Zero from");
        require(amount > 0, "amount=0");
        _burn(from, amount);
        emit AdminBurn(from, amount);
    }
}
