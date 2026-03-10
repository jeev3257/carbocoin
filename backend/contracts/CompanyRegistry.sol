// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Company Registry for EcoChain
/// @notice Owner (admin) records companies approved in Firebase to the blockchain and optionally funds them
contract CompanyRegistry {
    struct Company {
        string firebaseId;      // Firebase/Firestore company document ID
        string name;            // Company name
        address wallet;         // Company wallet (Sepolia/mainnet)
        string emissionCapText; // Display text e.g. "5000 tons/year"
        uint256 capKgPerWindow; // Numeric cap per 10-minute window (kg)
        uint256 recordedAt;     // Block timestamp when stored/updated
    }

    address public owner;
    uint256 public fundAmountWei = 0.1 ether;
    mapping(bytes32 => Company) private companies;
    mapping(address => bytes32) private walletToKey;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CompanyRecorded(bytes32 indexed key, string firebaseId, string name, address wallet, string emissionCapText, uint256 capKgPerWindow);
    event EmissionCapUpdated(bytes32 indexed key, string firebaseId, string emissionCapText, uint256 capKgPerWindow);
    event FundingSent(bytes32 indexed key, string firebaseId, address indexed wallet, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    receive() external payable {}

    function setFundAmountWei(uint256 amount) external onlyOwner {
        fundAmountWei = amount;
    }

    /// @notice Record company and fund in a single call. Sends msg.value to the company wallet (caller provides value).
    function recordCompanyAndFund(
        string calldata firebaseId,
        string calldata name,
        address wallet,
        string calldata emissionCapText,
        uint256 capKgPerWindow
    ) external payable onlyOwner {
        require(msg.value >= fundAmountWei, "insufficient msg.value");
        bytes32 key = _recordCompany(firebaseId, name, wallet, emissionCapText, capKgPerWindow);
        _sendFunding(key, firebaseId, wallet, msg.value);
    }

    /// @notice Record or overwrite a company entry without funding.
    function recordCompany(
        string calldata firebaseId,
        string calldata name,
        address wallet,
        string calldata emissionCapText,
        uint256 capKgPerWindow
    ) external onlyOwner {
        _recordCompany(firebaseId, name, wallet, emissionCapText, capKgPerWindow);
    }

    function _recordCompany(
        string calldata firebaseId,
        string calldata name,
        address wallet,
        string calldata emissionCapText,
        uint256 capKgPerWindow
    ) internal returns (bytes32 key) {
        require(bytes(firebaseId).length > 0, "firebaseId required");
        require(wallet != address(0), "wallet required");
        require(capKgPerWindow > 0, "cap required");

        key = keccak256(bytes(firebaseId));
        companies[key] = Company({
            firebaseId: firebaseId,
            name: name,
            wallet: wallet,
            emissionCapText: emissionCapText,
            capKgPerWindow: capKgPerWindow,
            recordedAt: block.timestamp
        });

        walletToKey[wallet] = key;

        emit CompanyRecorded(key, firebaseId, name, wallet, emissionCapText, capKgPerWindow);
    }

    function _sendFunding(bytes32 key, string calldata firebaseId, address wallet, uint256 amount) internal {
        (bool sent, ) = payable(wallet).call{value: amount}("");
        require(sent, "fund transfer failed");
        emit FundingSent(key, firebaseId, wallet, amount);
    }

    /// @notice Update emission cap only (keeping other fields intact).
    function updateEmissionCap(
        string calldata firebaseId,
        string calldata emissionCapText,
        uint256 capKgPerWindow
    ) external onlyOwner {
        require(bytes(firebaseId).length > 0, "firebaseId required");
        bytes32 key = keccak256(bytes(firebaseId));
        require(bytes(companies[key].firebaseId).length > 0, "company missing");
        require(capKgPerWindow > 0, "cap required");

        companies[key].emissionCapText = emissionCapText;
        companies[key].capKgPerWindow = capKgPerWindow;
        companies[key].recordedAt = block.timestamp;

        emit EmissionCapUpdated(key, firebaseId, emissionCapText, capKgPerWindow);
    }

    /// @notice View helper to fetch a company by firebaseId.
    function getCompany(string calldata firebaseId) external view returns (Company memory) {
        bytes32 key = keccak256(bytes(firebaseId));
        Company memory c = companies[key];
        require(bytes(c.firebaseId).length > 0, "company missing");
        return c;
    }

    function getCompanyByAddress(address wallet) external view returns (Company memory) {
        bytes32 key = walletToKey[wallet];
        Company memory c = companies[key];
        require(bytes(c.firebaseId).length > 0, "company missing");
        return c;
    }

    function getCapKgByWallet(address wallet) external view returns (uint256) {
        bytes32 key = walletToKey[wallet];
        Company memory c = companies[key];
        require(bytes(c.firebaseId).length > 0, "company missing");
        return c.capKgPerWindow;
    }
}
