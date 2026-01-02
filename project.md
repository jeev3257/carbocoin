# Project: Carbon Compliance and Marketplace Web App

## 1. Overview

This document outlines the technical details for building a carbon compliance and marketplace web application. The system has three core components:

1.  **Compliance System:** An administrator sets carbon emission caps for registered companies and tracks their emissions against these caps.
2.  **Marketplace:** At the end of a defined period, companies that have emitted less than their cap are issued their surplus as tradable carbon credit tokens. They can then sell these tokens on a marketplace to other companies looking to offset their emissions.
3.  **Prediction Model:** The application uses an XGBoost machine learning model to predict a company's future emissions based on real-time IoT data, helping them proactively manage their carbon footprint.

The core logic of the compliance and marketplace systems will be enforced by smart contracts on the blockchain, creating a transparent and immutable system.

## 2. System Architecture

### 2.1. Frontend

*   **Framework:** React.js
*   **Styling:** Tailwind CSS
*   **Key Libraries:**
    *   `ethers.js` or `web3.js` for interacting with the Ethereum blockchain.

### 2.2. Backend

*   **Framework:** Node.js with Express.js
*   **Databases:**
    *   **Firebase:** For user authentication, storing company details and documents, and receiving real-time emission data from IoT devices.
    *   **Neon (PostgreSQL):** For storing transaction-related data and application logs.
*   **Prediction Model:**
    *   An existing, pre-trained XGBoost model will be integrated into the backend.
    *   The model will use the real-time IoT data from Firebase to generate emission predictions.

### 2.3. Blockchain

*   **Platform:** Ethereum (Sepolia Testnet)
*   **Smart Contracts:** Solidity
*   **Key Features:**
    *   A central smart contract to manage companies, their emission caps, and the issuance of surplus credits.
    *   Smart contract logic to check if a company is under its cap at the end of a period and issue the surplus as ERC-20 tokens.
    *   A decentralized marketplace for trading the surplus credit tokens.
    *   A mechanism for "retiring" (burning) tokens to offset emissions.
    *   Emission of events for all major actions to create an on-chain audit trail.

## 3. Key Features

### 3.1. User Management

*   **Roles:** Company, Admin.
*   **Company:**
    *   Can register with their details and documents.
    *   Can view their emission cap and usage.
    *   Can submit emission reports.
    *   Can receive and trade surplus credit tokens.
    *   Can view their predicted emissions on their dashboard.
*   **Admin:**
    *   Can approve or reject company registrations.
    *   Can set and modify company emission caps.
    *   Can verify or reject emission reports.
    *   Can oversee the marketplace.

### 3.2. Carbon Cap Management

*   Admin sets an annual carbon emission cap for each company.
*   The cap is recorded on the blockchain.
*   At the end of the period, the smart contract compares the company's total emissions to their cap.

### 3.3. Surplus Credit Issuance

*   If a company's emissions are below their cap, the smart contract issues the surplus amount as ERC-20 tokens to the company's wallet.

### 3.4. Marketplace

*   Companies can list their surplus credit tokens for sale on a decentralized marketplace.
*   Other companies can buy these tokens to offset their own emissions.
*   The marketplace will show the current listings, prices, and trading history.

### 3.5. Emission Offsetting

*   Companies can "retire" (burn) the tokens they have bought to officially offset their emissions.
*   The retirement of tokens is a permanent and verifiable action on the blockchain.

### 3.6. Emission Prediction

*   The application uses a pre-trained XGBoost model to predict a company's future emissions.
*   The prediction is based on real-time data from IoT devices, which is streamed to Firebase.
*   The predicted emissions are displayed on the company's dashboard, helping them anticipate if they will exceed their cap and decide whether to buy more credits from the marketplace.

## 4. Technical Decisions

1.  **Blockchain Network:** The project will be deployed on the **Sepolia testnet**.
2.  **Token Standard:** The surplus carbon credits will be represented as **fungible tokens (ERC-20)**.
3.  **Data Storage:**
    *   **On-chain:** Company emission caps, the logic for issuing and trading surplus credits, and an audit trail of all major actions will be stored on-chain.
    *   **Off-chain:**
        *   **Firebase:** Used for user authentication, storing company details and documents, and receiving real-time emission data from IoT devices.
        *   **Neon (PostgreSQL):** Used for transaction-related data and application logs.
4.  **User Roles and Permissions:** The application will have two roles: **Company** and **Admin**, with permissions as described in the "Key Features" section.
5.  **Auditing Process:** The auditing process will be managed by the **Admin**, who will be responsible for verifying company registrations and emission reports.
6.  **External Integrations:** No external integrations are planned for now.