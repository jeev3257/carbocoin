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
  "function owedBalance(address company) view returns (uint256)",
  "function owedDueTime(address company) view returns (uint256)",
  "function gracePeriodSec() view returns (uint256)",
  "function penaltyAmount() view returns (uint256)",
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

const WINDOW_MS = Number(process.env.BATCH_WINDOW_MS || 10 * 60 * 1000);
const MIN_READINGS = Number(process.env.MIN_BATCH_READINGS || 10);
const MAX_READS = Number(process.env.MAX_BATCH_READS || 2000);
const RATE_LIMIT_SLEEP_MS = Number(process.env.RATE_LIMIT_SLEEP_MS || 300);
const COMPANY_CACHE_MS = Number(process.env.COMPANY_CACHE_MS || 5 * 60 * 1000);
// If the server was down for a bit, ignore readings older than this gap relative to "now"
// so we start a fresh window after a restart. Default 2 minutes.
const RESTART_GAP_MS =
  process.env.RESTART_GAP_MS === "0"
    ? 0
    : Number(process.env.RESTART_GAP_MS || 2 * 60 * 1000);

// Warmup guard: wait one full window after startup before submitting.
const START_TIME_MS = Date.now();
const ALLOW_PAST_READINGS = process.env.ALLOW_PAST_READINGS === "true";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedCompanies = [];
let lastCompanyFetch = 0;

async function fetchApprovedCompanies() {
  const now = Date.now();
  if (cachedCompanies.length && now - lastCompanyFetch < COMPANY_CACHE_MS) {
    return cachedCompanies;
  }
  const snapshot = await db
    .collection("companies")
    .where("status", "==", "approved")
    .get();
  cachedCompanies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  lastCompanyFetch = now;
  return cachedCompanies;
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
  // Optionally ignore persisted lastProcessed on restart to start fresh from server boot
  const effectiveCutoff =
    process.env.RESET_LAST_PROCESSED_ON_START === "true"
      ? START_TIME_MS
      : lastProcessed;
  const readingsRef = db
    .collection("emission")
    .doc(company.id)
    .collection("readings")
    .where("timestampMs", ">", effectiveCutoff)
    .orderBy("timestampMs")
    .limit(MAX_READS);

  const snapshot = await readingsRef.get();
  if (snapshot.empty) {
    console.log(
      `No readings for ${company.companyName || company.id} after cutoff=${effectiveCutoff} (lastProcessed=${lastProcessed}) (wallet=${company.walletAddress})`,
    );
    return null;
  }

  const allReadings = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const tsField = data.timestampMs || Date.parse(data.timestamp);
    const ts =
      typeof tsField === "number" && !Number.isNaN(tsField)
        ? tsField
        : doc.createTime?.toMillis?.();
    if (!ts || Number.isNaN(ts)) {
      continue;
    }
    // Ignore any reading that predates this server start, unless explicitly allowed
    if (!ALLOW_PAST_READINGS && ts < START_TIME_MS) {
      continue;
    }
    // Ignore readings older than last processed when set
    if (ts <= effectiveCutoff) {
      continue;
    }
    allReadings.push({
      timestampMs: ts,
      emissionKg: Number(data.emissionKg ?? 0),
      sensorId: data.sensorId || "sensor-unknown",
    });
  }

  // Sort ascending by timestamp to ensure windowing is correct
  allReadings.sort((a, b) => a.timestampMs - b.timestampMs);

  if (allReadings.length === 0) {
    console.log(
      `No usable readings for ${company.companyName || company.id} (wallet=${company.walletAddress}); snapshot=${snapshot.size}`,
    );
    return null;
  }

  // Anchor the window to the latest reading; also drop anything older than RESTART_GAP_MS from "now"
  // so a restart after a pause starts a fresh 10-minute window.
  const latestTs = allReadings[allReadings.length - 1].timestampMs;
  const restartBound = RESTART_GAP_MS ? Date.now() - RESTART_GAP_MS : -Infinity;
  const windowStartBound = Math.max(latestTs - WINDOW_MS, restartBound);
  const windowReadings = allReadings.filter(
    (r) => r.timestampMs >= windowStartBound,
  );

  console.log(
    `Window debug ${company.companyName || company.id}: totalReadings=${allReadings.length}, windowReadings=${windowReadings.length}, windowStartBound=${windowStartBound}, latestTs=${latestTs}, restartGapMs=${RESTART_GAP_MS}`,
  );

  const totalKg = windowReadings.reduce(
    (sum, r) => sum + Math.round(r.emissionKg),
    0,
  );

  if (windowReadings.length < MIN_READINGS) {
    const firstTs = windowReadings[0]?.timestampMs || null;
    console.log(
      `Not enough readings for ${company.companyName || company.id}: have ${windowReadings.length}, need ${MIN_READINGS} within ${WINDOW_MS / 60000} min window. cutoff=${effectiveCutoff} lastProcessed=${lastProcessed} firstTs=${firstTs} lastTs=${latestTs}`,
    );
    return null;
  }

  if (totalKg <= 0) {
    console.log(
      `Total emissionKg <= 0 for ${company.companyName || company.id} (wallet=${company.walletAddress})`,
    );
    return null;
  }

  const batchStartSec = Math.floor(windowReadings[0].timestampMs / 1000);
  const batchEndSec = Math.floor(latestTs / 1000);
  const batchHash = hashReadings(windowReadings);
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
    lastTimestampMs: latestTs,
    readingsCount: windowReadings.length,
  };
}

async function submitBatch(batch, company) {
  const prevIndex = await tokenContract.emissionHistoryLength(
    batch.companyAddress,
  );
  console.log(
    `Submitting batch → company=${company.companyName || company.id} wallet=${batch.companyAddress} emissionKg=${batch.emissionKg} window=${batch.startSec}-${batch.endSec} hash=${batch.batchHash}`,
  );
  let tx;
  try {
    tx = await tokenContract.submitBatch(
      batch.companyAddress,
      batch.emissionKg,
      batch.startSec,
      batch.endSec,
      batch.batchHash,
      batch.batchId,
    );
  } catch (err) {
    const alreadyKnown =
      err?.error?.message === "already known" ||
      (typeof err?.message === "string" &&
        err.message.includes("already known"));
    if (alreadyKnown && err?.payload?.params?.[0]) {
      try {
        const rawTx = err.payload.params[0];
        const parsed = ethers.Transaction.from(rawTx);
        const hash = parsed?.hash;
        if (hash) {
          console.warn(
            `Tx already known, waiting on existing hash=${hash} for ${company.companyName || company.id}`,
          );
          const existing = await provider.getTransaction(hash);
          if (existing) {
            const receipt = await provider.waitForTransaction(hash);
            console.log(
              `Known tx resolved for ${company.companyName || company.id}: status=${receipt?.status} hash=${hash}`,
            );
            if (!receipt) throw err;
            await persistChainBatch(
              batch,
              company,
              receipt,
              await tokenContract.getEmissionBatch(
                batch.companyAddress,
                prevIndex,
              ),
            );
            return;
          }
        }
      } catch (inner) {
        console.warn("Failed to resolve already-known tx; will rethrow", inner);
      }
    }
    throw err;
  }

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
  // Warmup: ensure a full window has elapsed since startup so we have 10 minutes of data.
  const sinceStart = Date.now() - START_TIME_MS;
  if (sinceStart < WINDOW_MS) {
    const remainingMs = WINDOW_MS - sinceStart;
    console.log(
      `Warmup: waiting ${(remainingMs / 60000).toFixed(2)} min before first batch submission to ensure full window of readings`,
    );
    return;
  }

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
          if (RATE_LIMIT_SLEEP_MS) await sleep(RATE_LIMIT_SLEEP_MS);
          continue;
        }
        await submitBatch(batch, company);
        await setLastProcessed(company.id, batch.lastTimestampMs);
        if (RATE_LIMIT_SLEEP_MS) await sleep(RATE_LIMIT_SLEEP_MS);
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
  console.log(
    "Emission batch submitter started (checks every minute for 10-min batches)",
  );
  await processOnce();
  // Run every minute so we don't miss a just-written reading; batch window stays 10 minutes via WINDOW_MS.
  cron.schedule("* * * * *", processOnce);
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
    owedTokens: null,
    owedDueTime: null,
    owedBalance: null,
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

  // Also store current owedBalance for the company to make UI simpler
  try {
    const currentOwed = await tokenContract.owedBalance(batch.companyAddress);
    await db.collection("companies").doc(company.id).set(
      {
        owedBalance: currentOwed.toString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Failed to fetch/store owedBalance:", err);
  }
}
