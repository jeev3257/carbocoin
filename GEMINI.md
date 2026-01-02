# Project: Carbon Compliance and Marketplace Web App

## 1. Project Overview

This project is a full-stack web application designed to be a carbon compliance and marketplace platform. It has three main components:

1.  **Compliance System:** An administrator sets carbon emission caps for registered companies and tracks their emissions.
2.  **Marketplace:** Companies that stay under their emission cap are issued their surplus as tradable ERC-20 tokens, which they can sell on a decentralized marketplace.
3.  **Prediction Model:** The application integrates a pre-trained XGBoost machine learning model to predict a company's future emissions based on real-time IoT data, helping them proactively manage their carbon footprint.

The application is built with a modern tech stack, including:

*   **Frontend:** React.js with Tailwind CSS.
*   **Backend:** Node.js with Express.js.
*   **Blockchain:** Solidity smart contracts on the Ethereum (Sepolia) testnet.
*   **Databases:**
    *   **Firebase:** For user authentication, company data, and real-time IoT data.
    *   **Neon (PostgreSQL):** For transaction-related data.
*   **Machine Learning:** A pre-trained XGBoost model for emission prediction.

## 2. Building and Running

### 2.1. Frontend

The frontend is a React application built with Vite.

To run the frontend locally:

1.  Navigate to the `frontend` directory: `cd frontend`
2.  Install the dependencies: `npm install`
3.  Start the development server: `npm run dev`

To build the frontend for production:

1.  Navigate to the `frontend` directory: `cd frontend`
2.  Run the build command: `npm run build`

### 2.2. Backend

The backend is a Node.js application using Express.js.

To run the backend locally:

1.  Navigate to the `backend` directory: `cd backend`
2.  Install the dependencies: `npm install`
3.  Start the server: `npm start` (Note: The `start` script is not yet defined in `package.json`. We should add it.)

### 2.3. Smart Contracts

The smart contracts are written in Solidity. We will use a development environment like Hardhat to compile, test, and deploy them.

**TODO:** Set up a Hardhat project for the smart contracts.

Once Hardhat is set up, the typical commands will be:

*   Compile the contracts: `npx hardhat compile`
*   Run the tests: `npx hardhat test`
*   Deploy the contracts: `npx hardhat run scripts/deploy.js --network sepolia`

## 3. Development Conventions

*   **Code Style:** The frontend uses ESLint for code linting. Please adhere to the rules defined in the `.eslintrc.js` file.
*   **React:** Use functional components and hooks.
*   **Backend:** Follow a modular structure for the Express.js application (e.g., separate routes, controllers, and services).
*   **Git:** Follow a consistent branching model (e.g., GitFlow) and write clear and concise commit messages.
*   **Testing:**
    *   **Frontend:** Write unit tests for React components using a framework like Jest and React Testing Library.
    *   **Backend:** Write unit and integration tests for the API endpoints.
    *   **Smart Contracts:** Write comprehensive tests for the smart contracts using Hardhat's testing environment.
