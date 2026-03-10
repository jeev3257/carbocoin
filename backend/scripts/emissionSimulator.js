// Emission simulator: fetch approved companies and store periodic readings in Firestore
// Prerequisites:
// - Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON, or run where ADC is available.
// - Install deps: npm install (firebase-admin, node-cron already in package.json).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const cron = require("node-cron");
const fs = require("fs");
const {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
  getApp,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Init Firebase Admin: prefer explicit service account, fallback to ADC
let credential;
const localSaPath = path.join(__dirname, "firebase_sdk.json");

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Path to service account JSON file
  // eslint-disable-next-line import/no-dynamic-require, global-require
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

const SENSOR_ID = "sensor-1";
const UNIT = "ppm";

// Demo targets: keep a 10-minute aggregate in the 88–110 tons range, but vary each minute
const FLOW_NM3_S = 10000; // assumed stack flow for demo
const MW_CO2 = 44.01; // g/mol
const MOLAR_VOLUME = 24.45; // L per mol at 25C, 1 atm

let currentWindowId = null;
let targetTonsPer10 = 100; // will reset each window
let perMinutePlan = []; // length 10, sums to target

function buildWindowPlan() {
  targetTonsPer10 = 88 + Math.random() * (110 - 88); // target total for 10-min window
  const weights = Array.from({ length: 10 }, () => Math.random() + 0.1); // avoid zeros
  const sum = weights.reduce((a, b) => a + b, 0);
  perMinutePlan = weights.map((w) => (w / sum) * targetTonsPer10);
}

function tonsPerMinuteToPpm(tonsPerMinute, flowNm3s = FLOW_NM3_S) {
  const kgPerS = (tonsPerMinute * 1000) / 60; // tons/min -> kg/s
  const mgPerM3 = (kgPerS * 1e6) / flowNm3s;
  const ppm = (mgPerM3 * MOLAR_VOLUME) / MW_CO2;
  return ppm;
}

function generateEmission() {
  const now = Date.now();
  const windowId = Math.floor(now / 600000); // 10-minute buckets
  const minuteOffset = Math.floor((now % 600000) / 60000); // 0-9

  if (windowId !== currentWindowId || perMinutePlan.length !== 10) {
    currentWindowId = windowId;
    buildWindowPlan();
  }

  const tonsPerMinute = perMinutePlan[minuteOffset] || targetTonsPer10 / 10;
  const ppm = tonsPerMinuteToPpm(tonsPerMinute);

  return {
    ppm,
    flow: FLOW_NM3_S,
    tons10: targetTonsPer10,
    tonsPerMinute,
  };
}

async function fetchApprovedCompanies() {
  const snapshot = await db
    .collection("companies")
    .where("status", "==", "approved")
    .get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function storeReading(company) {
  const { ppm, flow, tons10, tonsPerMinute } = generateEmission();
  const payload = {
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    emission: ppm,
    sensorId: SENSOR_ID,
    unit: UNIT,
    emissionKg: tonsPerMinute * 1000,
  };

  await db
    .collection("emission")
    .doc(company.id)
    .collection("readings")
    .add(payload);

  console.log(
    `Emission stored for ${company.companyName} | ppm=${ppm.toFixed(2)} | flow=${flow} Nm3/s | target_tons_10min=${tons10.toFixed(2)} | this_min≈${tonsPerMinute.toFixed(2)} tons`,
  );
}

async function tick() {
  try {
    const companies = await fetchApprovedCompanies();
    if (!companies.length) {
      console.log("No approved companies found; skipping this run.");
      return;
    }

    await Promise.all(companies.map((c) => storeReading(c)));
  } catch (err) {
    console.error("Error during emission simulation:", err);
  }
}

// Run immediately once, then every minute
(async () => {
  await tick();
  cron.schedule("* * * * *", tick);
  console.log("Emission simulator started (runs every minute)");
})();

// Auto-start the batch submitter so 10-minute aggregation kicks in without a second command.
if (process.env.AUTO_START_BATCH_SUBMITTER !== "false") {
  console.log("Auto-start enabled → launching emissionBatchSubmitter...");
  require("./emissionBatchSubmitter");
}
