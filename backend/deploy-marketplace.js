require("dotenv").config();
const { ethers } = require("ethers");
const artifact = require("../artifacts/CarbonCreditMarketplace.json");
const abi = artifact.abi || artifact.data?.abi;
const bytecode = artifact.data?.bytecode?.object || artifact.bytecode;
const cct =
  process.env.VITE_CARBON_TOKEN_ADDRESS ||
  "0xd306eF60FabE18cf2C55fD38f305959e8C7b438c";
const rpc = process.env.VITE_SEPOLIA_RPC_URL;
const pk = process.env.VITE_ADMIN_PRIVATE_KEY;
if (!rpc || !pk)
  throw new Error("Missing VITE_SEPOLIA_RPC_URL or VITE_ADMIN_PRIVATE_KEY");

(async () => {
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(cct);
  console.log("Deploying marketplace...", contract.target);
  await contract.waitForDeployment();
  console.log("Marketplace deployed at", contract.target);
})();
