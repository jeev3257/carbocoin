/*
 * Tiny ingest proxy: accepts sensor readings over HTTP and writes them to Firestore
 * with server-side timestamps. Run with `node emissionIngestProxy.js` from this folder.
 */

const path = require('path');
const express = require('express');
const admin = require('firebase-admin');

// ---- config ----
const PORT = process.env.INGEST_PORT || 4000;
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, 'firebase_sdk.json');

// ---- firebase init ----
try {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to load Firebase service account:', err.message);
  process.exit(1);
}

const db = admin.firestore();

// ---- app ----
const app = express();
app.use(express.json());

// basic health
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ingest endpoint
app.post('/ingest', async (req, res) => {
  const { companyId, sensorId = 'sensor-1', emissionKg, ppm } = req.body || {};

  if (!companyId || typeof companyId !== 'string') {
    return res.status(400).json({ error: 'companyId required' });
  }
  if (typeof emissionKg !== 'number' || Number.isNaN(emissionKg)) {
    return res.status(400).json({ error: 'emissionKg (number) required' });
  }
  const timestampMs = Date.now();
  const timestampIso = new Date(timestampMs).toISOString();

  const doc = {
    emissionKg,
    emission: typeof ppm === 'number' && !Number.isNaN(ppm) ? ppm : undefined,
    unit: 'ppm',
    sensorId,
    timestamp: timestampIso,
    timestampMs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // remove undefined fields (emission optional)
  Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);

  try {
    await db.collection('emission').doc(companyId).collection('readings').add(doc);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Firestore write failed:', err.message);
    return res.status(500).json({ error: 'firestore write failed' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ingest proxy listening on :${PORT}`);
});
