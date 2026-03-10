// Aggregates 10-minute emission readings per company and submits batches to CarbonCreditToken
// Usage: node scripts/emissionBatchSubmitter.js
// Requires env vars:
//   SEPOLIA_RPC_URL or VITE_SEPOLIA_RPC_URL
//   CARBON_ADMIN_PRIVATE_KEY or VITE_ADMIN_PRIVATE_KEY
//   CARBON_TOKEN_ADDRESS (deployed CarbonCreditToken)

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const cron = require("node-cron");
const crypto = require("crypto");
const fs = require("fs");
const { ethers } = require("ethers");
const {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
  getApp,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Firebase admin init (reuse local firebase_sdk.json if present)
let credential;
const localSaPath = path.join(__dirname, "firebase_sdk.json");
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const sa = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  credential = cert(sa);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
} else if (fs.existsSync(localSaPath)) {
  const sa = require(localSaPath);
  credential = cert(sa);
} else {
  credential = applicationDefault();
}
const firebaseApp = getApps().length ? getApp() : initializeApp({ credential });
const db = getFirestore(firebaseApp);

// Blockchain setup
const RPC_URL =
  process.env.CARBON_RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  process.env.VITE_SEPOLIA_RPC_URL;
const ADMIN_KEY =
  process.env.CARBON_ADMIN_PRIVATE_KEY ||
  process.env.ADMIN_PRIVATE_KEY ||
  process.env.VITE_ADMIN_PRIVATE_KEY;
const TOKEN_ADDRESS =
  process.env.CARBON_TOKEN_ADDRESS || process.env.VITE_CARBON_TOKEN_ADDRESS;

if (!RPC_URL || !ADMIN_KEY || !TOKEN_ADDRESS) {
  console.error(
    "Missing RPC URL, admin private key, or token address env vars.",
  );
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(ADMIN_KEY, provider);
const tokenAbi = [
  "function submitBatch(address company,uint256 emissionKg,uint256 batchStartTime,uint256 batchEndTime,bytes32 batchHash,bytes32 batchId) external",
  "function emissionHistoryLength(address company) view returns (uint256)",
  "function getEmissionBatch(address company,uint256 index) view returns (uint256 startTime,uint256 endTime,uint256 emissionKg,uint256 capKg,bytes32 dataHash,int256 tokenChange,uint256 mintedTokens,uint256 burnedTokens,bytes32 batchId)",
];
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, signer);
const tokenAddressLower = TOKEN_ADDRESS.toLowerCase();
const transferIface = new ethers.Interface([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const transferTopic = transferIface.getEvent("Transfer").topicHash;
const inFlightTxs = new Set();

async function gracefulShutdown() {
  if (!inFlightTxs.size) {
    process.exit(0);
  }
  console.log(
    `Waiting for ${inFlightTxs.size} pending batch transaction(s) to confirm before exit...`,
  );
  try {
    await Promise.all(
      Array.from(inFlightTxs).map((hash) =>
        provider
          .waitForTransaction(hash)
          .catch((err) => console.error(`Error waiting for tx ${hash}:`, err)),
      ),
    );
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

const WINDOW_MS = 10 * 60 * 1000;

async function fetchApprovedCompanies() {
  const snapshot = await db
    .collection("companies")
    .where("status", "==", "approved")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getLastProcessed(companyId) {
  const docRef = db.collection("emission").doc(companyId);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return docSnap.data().lastProcessedAt || 0;
  }
  return 0;
}

async function setLastProcessed(companyId, timestampMs) {
  const docRef = db.collection("emission").doc(companyId);
  await docRef.set({ lastProcessedAt: timestampMs }, { merge: true });
}

function hashReadings(readings) {
  const json = JSON.stringify(readings);
  return `0x${crypto.createHash("sha256").update(json).digest("hex")}`;
}

async function buildBatch(company) {
  if (!company.walletAddress) {
    console.warn(
      `Skipping ${company.companyName || company.id}: missing walletAddress`,
    );
    return null;
  }

  const lastProcessed = await getLastProcessed(company.id);
  const readingsRef = db
    .collection("emission")
    .doc(company.id)
    .collection("readings")
    .where("timestampMs", ">", lastProcessed)
    .orderBy("timestampMs");

  const snapshot = await readingsRef.get();
  if (snapshot.empty) {
    console.log(
      `No readings for ${company.companyName || company.id} after lastProcessedAt=${lastProcessed} (wallet=${company.walletAddress})`,
    );
    return null;
  }

  const readings = [];
  let windowStart = null;
  let windowEnd = null;
  let totalKg = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const ts = data.timestampMs || Date.parse(data.timestamp);
    if (!ts) {
      continue;
    }
    if (windowStart === null) {
      windowStart = ts;
    }
    if (ts - windowStart > WINDOW_MS) {
      break;
    }
    windowEnd = ts;
    const emissionKg = Number(data.emissionKg ?? 0);
    totalKg += Math.round(emissionKg);
    readings.push({
      timestampMs: ts,
      emissionKg,
      sensorId: data.sensorId || "sensor-unknown",
    });
  }

  if (!windowStart || !windowEnd || readings.length === 0) {
    console.log(
      `No usable readings for ${company.companyName || company.id} (wallet=${company.walletAddress}); snapshot=${snapshot.size}`,
    );
    return null;
  }

  if (readings.length < 10) {
    console.log(
      `Not enough readings for ${company.companyName || company.id}: have ${readings.length}, need 10 within ${WINDOW_MS / 60000} min window. lastProcessedAt=${lastProcessed} firstTs=${windowStart} lastTs=${windowEnd}`,
    );
    return null;
  }

  if (totalKg <= 0) {
    console.log(
      `Total emissionKg <= 0 for ${company.companyName || company.id} (wallet=${company.walletAddress})`,
    );
    return null;
  }

  const batchHash = hashReadings(readings);
  const batchStartSec = Math.floor(windowStart / 1000);
  const batchEndSec = Math.floor(windowEnd / 1000);
  const batchId = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "bytes32"],
    [company.walletAddress, batchStartSec, batchEndSec, batchHash],
  );

  return {
    companyAddress: company.walletAddress,
    companyId: company.id,
    companyName: company.companyName || company.id,
    emissionKg: totalKg,
    startSec: batchStartSec,
    endSec: batchEndSec,
    batchHash,
    batchId,
    lastTimestampMs: windowEnd,
    readingsCount: readings.length,
  };
}

async function submitBatch(batch, company) {
  const prevIndex = await tokenContract.emissionHistoryLength(
    batch.companyAddress,
  );
  console.log(
    `Submitting batch → company=${company.companyName || company.id} wallet=${batch.companyAddress} emissionKg=${batch.emissionKg} window=${batch.startSec}-${batch.endSec} hash=${batch.batchHash}`,
  );
  const tx = await tokenContract.submitBatch(
    batch.companyAddress,
    batch.emissionKg,
    batch.startSec,
    batch.endSec,
    batch.batchHash,
    batch.batchId,
  );
  inFlightTxs.add(tx.hash);
  const receipt = await tx.wait();
  inFlightTxs.delete(tx.hash);
  const batchIndex = prevIndex; // new record sits at previous length index
  const contractBatch = await tokenContract.getEmissionBatch(
    batch.companyAddress,
    batchIndex,
  );
  await persistChainBatch(batch, company, receipt, contractBatch);
  const mintedTxt = contractBatch.mintedTokens.toString();
  const burnedTxt = contractBatch.burnedTokens.toString();
  if (mintedTxt === "0" && burnedTxt === "0") {
    console.log(
      `Batch recorded but no token change for ${company.companyName || company.id} (emissionKg=${batch.emissionKg}, capKg=${contractBatch.capKg.toString()})`,
    );
  }
  console.log(
    `Batch submitted for ${company.companyName || company.id} | emissionKg=${batch.emissionKg} | minted=${mintedTxt} | burned=${burnedTxt} | tx=${receipt.hash}`,
  );
}

async function processOnce() {
  try {
    const companies = await fetchApprovedCompanies();
    if (!companies.length) {
      console.log("No approved companies found for batch submission");
      return;
    }

    for (const company of companies) {
      try {
        const batch = await buildBatch(company);
        if (!batch) {
          continue;
        }
        await submitBatch(batch, company);
        await setLastProcessed(company.id, batch.lastTimestampMs);
      } catch (err) {
        console.error(
          `Failed to submit batch for ${company.companyName || company.id}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("Batch processor error:", err);
  }
}

(async () => {
  console.log("Emission batch submitter started (runs every 10 minutes)");
  await processOnce();
  cron.schedule("*/10 * * * *", processOnce);
})();

function extractTransfers(receipt) {
  const transfers = [];
  for (const log of receipt.logs) {
    if (!log.topics || log.topics.length === 0) {
      continue;
    }
    if (log.address.toLowerCase() !== tokenAddressLower) {
      continue;
    }
    if (log.topics[0] !== transferTopic) {
      continue;
    }
    const parsed = transferIface.parseLog(log);
    transfers.push({
      from: parsed.args.from,
      to: parsed.args.to,
      value: parsed.args.value.toString(),
    });
  }
  return transfers;
}

async function persistChainBatch(batch, company, receipt, contractBatch) {
  const docId = batch.batchId;
  const txHash = receipt.hash || receipt.transactionHash;
  const chainDoc = {
    companyId: company.id,
    companyName: company.companyName || company.id,
    companyWallet: batch.companyAddress,
    batchId: batch.batchId,
    batchHash: batch.batchHash,
    batchStartSec: Number(contractBatch.startTime),
    batchEndSec: Number(contractBatch.endTime),
    emissionKgInput: batch.emissionKg,
    emissionKgOnChain: Number(contractBatch.emissionKg),
    capKgOnChain: Number(contractBatch.capKg),
    mintedTokens: contractBatch.mintedTokens.toString(),
    burnedTokens: contractBatch.burnedTokens.toString(),
    tokenChange: contractBatch.tokenChange.toString(),
    readingsCount: batch.readingsCount,
    dataHash: contractBatch.dataHash,
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : null,
    erc20Transfers: extractTransfers(receipt),
    submittedAt: new Date().toISOString(),
    integrityStatus: "recorded",
    source: "emissionBatchSubmitter",
  };

  await db.collection("chainBatches").doc(docId).set(chainDoc);
}
