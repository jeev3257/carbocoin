// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ICompanyRegistry {
    function getCapKgByWallet(address wallet) external view returns (uint256);
}

/// @title Carbon Credit Token (CCT) with on-chain emission verification
/// @notice Owner submits 10-minute emission batches. Caps sourced from CompanyRegistry.
///         Under-cap → mint credits; over-cap → burn credits (if held).
contract CarbonCreditToken {
    // --- ERC20 basics (decimals = 0; 1 token = 1 ton = 1000 kg) ---
    string public name = "CarbonCreditToken";
    string public symbol = "CCT";
    uint8 public constant decimals = 0;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // --- Ownership ---
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // --- External registry ---
    ICompanyRegistry public immutable registry;

    /// @dev prevent duplicate batches
    mapping(bytes32 => bool) public processedBatches;

        struct EmissionBatch {
            uint256 startTime;
            uint256 endTime;
            uint256 emissionKg;
            uint256 capKg;
            bytes32 dataHash;
            int256 tokenChange; // + for mint, - for burn
            uint256 mintedTokens;
            uint256 burnedTokens;
            bytes32 batchId;
        }

    /// @dev history per company
    mapping(address => EmissionBatch[]) public emissionHistory;

    // --- Events ---
    event BatchRecorded(
        address indexed company,
        bytes32 batchHash,
        bytes32 batchId,
        uint256 startTime,
        uint256 endTime,
        uint256 emissionKg,
        uint256 capKg,
        uint256 mintedTokens,
        uint256 burnedTokens,
        int256 tokenChange
    );
    event CreditsIssued(address indexed company, uint256 tokens);
    event PenaltyApplied(address indexed company, uint256 tokens);

    // --- Constructor ---
    constructor(address registryAddress) {
        require(registryAddress != address(0), "registry required");
        registry = ICompanyRegistry(registryAddress);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- Ownership controls ---
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --- ERC20 internals ---
    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "Zero to");
        uint256 fromBal = balanceOf[from];
        require(fromBal >= amount, "Balance too low");
        unchecked {
            balanceOf[from] = fromBal - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "Allowance too low");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Zero to");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "Burn exceeds balance");
        unchecked {
            balanceOf[from] = bal - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    // --- Batch submission (only owner/aggregator) ---
    /// @param company company wallet
    /// @param emissionKg emission in kilograms for the 10-minute batch
    /// @param batchStartTime start timestamp (seconds)
    /// @param batchEndTime end timestamp (seconds)
    /// @param batchHash SHA-256 hash of the 10-minute dataset
    /// @param batchId unique id to prevent duplicates
    function submitBatch(
        address company,
        uint256 emissionKg,
        uint256 batchStartTime,
        uint256 batchEndTime,
        bytes32 batchHash,
        bytes32 batchId
    ) external onlyOwner {
        require(!processedBatches[batchId], "Batch already processed");
        processedBatches[batchId] = true;

        uint256 capKg = registry.getCapKgByWallet(company);
        require(capKg > 0, "cap missing");
        int256 tokenChange = 0;
        uint256 mintedTokens = 0;
        uint256 burnedTokens = 0;

        if (emissionKg < capKg) {
            uint256 diffKg = capKg - emissionKg;
            uint256 mintTokens = diffKg / 1000; // 1000 kg = 1 token
            if (mintTokens > 0) {
                _mint(company, mintTokens);
                emit CreditsIssued(company, mintTokens);
                tokenChange = int256(mintTokens);
                mintedTokens = mintTokens;
            }
        } else if (emissionKg > capKg) {
            uint256 exceedKg = emissionKg - capKg;
            uint256 burnTokens = exceedKg / 1000;
            if (burnTokens > 0) {
                uint256 available = balanceOf[company];
                uint256 toBurn = burnTokens > available ? available : burnTokens;
                if (toBurn > 0) {
                    _burn(company, toBurn);
                    emit PenaltyApplied(company, toBurn);
                    tokenChange = -int256(toBurn);
                    burnedTokens = toBurn;
                }
            }
        }

        // Record batch
        emissionHistory[company].push(
            EmissionBatch({
                startTime: batchStartTime,
                endTime: batchEndTime,
                emissionKg: emissionKg,
                capKg: capKg,
                dataHash: batchHash,
                tokenChange: tokenChange,
                mintedTokens: mintedTokens,
                burnedTokens: burnedTokens,
                batchId: batchId
            })
        );

        emit BatchRecorded(
            company,
            batchHash,
            batchId,
            batchStartTime,
            batchEndTime,
            emissionKg,
            capKg,
            mintedTokens,
            burnedTokens,
            tokenChange
        );
    }

    // --- View helpers ---
    function emissionHistoryLength(address company) external view returns (uint256) {
        return emissionHistory[company].length;
    }

    function getEmissionBatch(address company, uint256 index) external view returns (EmissionBatch memory) {
        require(index < emissionHistory[company].length, "index out of bounds");
        return emissionHistory[company][index];
    }
}
