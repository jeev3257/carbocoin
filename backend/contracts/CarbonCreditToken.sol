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

    struct TempBatch {
        int256 tokenChange;
        uint256 minted;
        uint256 burned;
        uint256 owedTokens;
    }

    // --- Debt tracking ---
    mapping(address => uint256) public owedBalance; // total unpaid burn debt per company
    mapping(address => uint256) public owedDueTime; // next deadline when penalties start accruing
    uint256 public gracePeriodSec = 15 minutes;
    uint256 public penaltyAmount = 3; // fixed tokens added per overdue interval

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
    event OwedRecorded(address indexed company, uint256 owedTokens, uint256 dueTime);
    event OwedSettled(address indexed company, uint256 settledTokens, uint256 remainingOwed);
    event OwedPenaltyApplied(address indexed company, uint256 addedTokens, uint256 newOwed, uint256 nextDueTime);
    event BatchOwed(address indexed company, bytes32 batchId, uint256 owedTokens, uint256 dueTime);
    event GracePeriodUpdated(uint256 gracePeriodSec);
    event PenaltyAmountUpdated(uint256 penaltyAmount);
    event AdminMint(address indexed to, uint256 amount);
    event AdminBurn(address indexed from, uint256 amount);

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

    function setGracePeriod(uint256 seconds_) external onlyOwner {
        require(seconds_ > 0, "grace > 0");
        gracePeriodSec = seconds_;
        emit GracePeriodUpdated(seconds_);
    }

    function setPenaltyAmount(uint256 amount) external onlyOwner {
        require(amount > 0, "penalty > 0");
        penaltyAmount = amount;
        emit PenaltyAmountUpdated(amount);
    }

    /// @notice owner-only helper to mint tokens directly (admin/test tooling) while first settling any owed balance
    function adminMint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero to");
        require(amount > 0, "amount=0");

        uint256 owed = owedBalance[to];
        if (owed > 0) {
            if (amount >= owed) {
                // Clear debt first, mint remainder
                owedBalance[to] = 0;
                owedDueTime[to] = 0;
                emit OwedSettled(to, owed, 0);

                uint256 netMint = amount - owed;
                if (netMint > 0) {
                    _mint(to, netMint);
                    emit AdminMint(to, netMint);
                }
            } else {
                // Reduce debt only; no net mint
                owedBalance[to] = owed - amount;
                emit OwedSettled(to, amount, owed - amount);
                return;
            }
        } else {
            _mint(to, amount);
            emit AdminMint(to, amount);
        }
    }

    /// @notice owner-only helper to burn tokens from a holder (admin/test tooling)
    function adminBurn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "Zero from");
        require(amount > 0, "amount=0");
        _burn(from, amount);
        emit AdminBurn(from, amount);
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

        _applyPenalty(company);

        uint256 capKg = registry.getCapKgByWallet(company);
        require(capKg > 0, "cap missing");
        TempBatch memory t;

        if (emissionKg < capKg) {
            uint256 diffKg = capKg - emissionKg;
            uint256 mintTokens = diffKg / 1000; // 1000 kg = 1 token
            if (mintTokens > 0) {
                _mintAndSettle(company, mintTokens, t);
            }
        } else if (emissionKg > capKg) {
            uint256 exceedKg = emissionKg - capKg;
            uint256 burnTokens = exceedKg / 1000;
            if (burnTokens > 0) {
                _burnAndAccrue(company, burnTokens, t);
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
                tokenChange: t.tokenChange,
                mintedTokens: t.minted,
                burnedTokens: t.burned,
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
            t.minted,
            t.burned,
            t.tokenChange
        );

        if (t.owedTokens > 0) {
            emit BatchOwed(company, batchId, t.owedTokens, owedDueTime[company]);
        }
    }

    function _applyPenalty(address company) internal {
        uint256 due = owedDueTime[company];
        if (owedBalance[company] == 0 || due == 0 || block.timestamp <= due) {
            return;
        }

        uint256 intervals = (block.timestamp - due) / gracePeriodSec + 1;
        uint256 added = intervals * penaltyAmount;
        owedBalance[company] = owedBalance[company] + added;
        owedDueTime[company] = due + intervals * gracePeriodSec;
        emit OwedPenaltyApplied(company, added, owedBalance[company], owedDueTime[company]);
    }

    function _mintAndSettle(address company, uint256 mintTokens, TempBatch memory t) internal {
        uint256 owed = owedBalance[company];
        if (owed > 0) {
            if (mintTokens >= owed) {
                uint256 netMint = mintTokens - owed;
                owedBalance[company] = 0;
                owedDueTime[company] = 0;
                emit OwedSettled(company, owed, 0);
                if (netMint > 0) {
                    _mint(company, netMint);
                    emit CreditsIssued(company, netMint);
                    t.minted = netMint;
                    t.tokenChange = int256(netMint);
                }
            } else {
                owedBalance[company] = owed - mintTokens;
                emit OwedSettled(company, mintTokens, owed - mintTokens);
            }
        } else {
            _mint(company, mintTokens);
            emit CreditsIssued(company, mintTokens);
            t.minted = mintTokens;
            t.tokenChange = int256(mintTokens);
        }
    }

    function _burnAndAccrue(address company, uint256 burnTokens, TempBatch memory t) internal {
        uint256 toBurn = burnTokens;
        {
            uint256 available = balanceOf[company];
            if (toBurn > available) {
                toBurn = available;
            }
        }
        if (toBurn > 0) {
            _burn(company, toBurn);
            emit PenaltyApplied(company, toBurn);
            t.tokenChange = -int256(toBurn);
            t.burned = toBurn;
        }

        if (burnTokens > toBurn) {
            uint256 shortfall = burnTokens - toBurn;
            owedBalance[company] += shortfall;
            uint256 newDue = block.timestamp + gracePeriodSec;
            uint256 nextDue = owedDueTime[company];
            if (nextDue == 0 || newDue < nextDue) {
                nextDue = newDue;
            }
            owedDueTime[company] = nextDue;
            t.owedTokens = shortfall;
            emit OwedRecorded(company, shortfall, nextDue);
        }
    }

    function settleOwed(uint256 amount) external {
        address company = msg.sender;
        uint256 owed = owedBalance[company];
        require(owed > 0, "no owed");
        uint256 bal = balanceOf[company];
        uint256 toBurn = amount > bal ? bal : amount;
        require(toBurn > 0, "no balance");
        _burn(company, toBurn);
        if (toBurn >= owed) {
            owedBalance[company] = 0;
            owedDueTime[company] = 0;
            emit OwedSettled(company, owed, 0);
        } else {
            owedBalance[company] = owed - toBurn;
            emit OwedSettled(company, toBurn, owed - toBurn);
        }
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
