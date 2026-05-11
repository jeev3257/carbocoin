"""
CarboCoin Emission Prediction Service
Loads emission_prediction_model.pkl (XGBRegressor) and serves forecasts via Flask.

Start with: python prediction_service.py
Default port: 5001
"""

import os
import sys
import pickle
import logging
import traceback
import re
from pathlib import Path

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("prediction_service")

app = Flask(__name__)
CORS(app)

@app.before_request
def _ensure_model():
    ensure_model_loaded()

# ── Load model ──────────────────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent / "emission_prediction_model.pkl"
model = None

def load_model():
    global model
    if model is not None:
        return
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        log.info("Model loaded from %s", MODEL_PATH)
    except Exception as e:
        log.error("Failed to load model: %s", e)
        sys.exit(1)


def ensure_model_loaded():
    """Load the model on-demand (needed when running via `flask run`)."""
    if model is None:
        load_model()

# ── Categorical encodings  ───────────────────────────────────────────────────────
# These mirror the label-encoding used during training.
INDUSTRY_MAP = {
    "manufacturing": 0,
    "steel":         1,
    "cement":        2,
    "chemical":      3,
    "energy":        4,
    "power":         4,
    "oil":           5,
    "gas":           6,
    "textile":       7,
    "paper":         8,
    "other":         9,
}

FUEL_MAP = {
    "coal":          0,
    "natural gas":   1,
    "gas":           1,
    "oil":           2,
    "diesel":        2,
    "biomass":       3,
    "mixed":         4,
    "electricity":   5,
    "other":         6,
}

def encode_category(value: str, mapping: dict, default: int = 0) -> int:
    if not value:
        return default
    key = str(value).strip().lower()
    # Try exact match first, then partial
    if key in mapping:
        return mapping[key]
    for k, v in mapping.items():
        if k in key or key in k:
            return v
    return default


def build_features(
    emission_t:   float,
    emission_t1:  float,
    emission_t2:  float,
    emission_t3:  float,
    industry:     str,
    fuel:         str,
    production:   float,
    hour:         int,
) -> np.ndarray:
    """
    Assemble the 11-feature vector the model expects:
    [industry_type, fuel_type, production_rate, hour,
     emission_t3, emission_t2, emission_t1, emission_t,
     growth_rate, trend_t1, trend_t2]
    """
    # Growth rate: relative change from t-1 → t
    if emission_t1 != 0:
        growth_rate = (emission_t - emission_t1) / abs(emission_t1)
    else:
        growth_rate = 0.0

    # Short-term trends (differences)
    trend_t1 = emission_t  - emission_t1  # t → t-1
    trend_t2 = emission_t1 - emission_t2  # t-1 → t-2

    features = np.array([[
        encode_category(industry, INDUSTRY_MAP),
        encode_category(fuel,     FUEL_MAP),
        float(production),
        float(hour),
        float(emission_t3),
        float(emission_t2),
        float(emission_t1),
        float(emission_t),
        float(growth_rate),
        float(trend_t1),
        float(trend_t2),
    ]])
    return features


def parse_float_maybe(value):
    """Best-effort float parser; extracts leading numeric from strings like '100 tons/year'."""
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        pass
    if isinstance(value, str):
        match = re.findall(r"[-+]?[0-9]*\.?[0-9]+", value)
        if match:
            try:
                return float(match[0])
            except Exception:
                return None
    return None


def rolling_forecast(
    history:    list,
    industry:   str,
    fuel:       str,
    production: float,
    steps:      int,
    start_hour: int,
) -> list:
    """
    Generate `steps` future predictions by rolling the window forward.
    history must have at least 4 values (oldest → newest).
    """
    window = list(history[-4:])   # [t-3, t-2, t-1, t]
    predictions = []

    for i in range(steps):
        et3, et2, et1, et = window[-4], window[-3], window[-2], window[-1]
        hour = (start_hour + i) % 24

        feats = build_features(et, et1, et2, et3, industry, fuel, production, hour)
        pred = float(model.predict(feats)[0])
        pred = max(pred, 0.0)  # emission can't be negative

        predictions.append(round(pred, 4))
        window.append(pred)

    return predictions


# ── Endpoints ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})


@app.post("/predict")
def predict():
    try:
        data = request.get_json(force=True)

        # --- Required: recent emission readings (at least 4) ---
        emissions_raw = data.get("emissions", [])
        if not isinstance(emissions_raw, list) or len(emissions_raw) < 1:
            return jsonify({"error": "Need at least 1 emission reading"}), 400

        # Pad to 4 if fewer provided
        emissions = []
        for idx, v in enumerate(emissions_raw):
            parsed = parse_float_maybe(v)
            if parsed is None:
                return jsonify({"error": f"Invalid emission reading at index {idx}"}), 400
            emissions.append(float(parsed))
        while len(emissions) < 4:
            emissions.insert(0, emissions[0] if emissions else 0.0)

        # --- Optional params ---
        industry   = str(data.get("industry",   "manufacturing"))
        fuel       = str(data.get("fuel",       "coal"))
        production_raw = data.get("production", 500.0)
        production = parse_float_maybe(production_raw)
        if production is None:
            production = 500.0
        steps      = int(data.get("steps", 8))
        steps      = max(1, min(steps, 96))   # cap at 96 steps (e.g. 8 h at 5-min intervals)
        cap_raw    = data.get("cap", None)
        cap_kg     = parse_float_maybe(cap_raw)
        start_hour = int(data.get("hour", __import__("datetime").datetime.utcnow().hour))

        # --- Single next-step prediction ---
        et3, et2, et1, et = emissions[-4], emissions[-3], emissions[-2], emissions[-1]
        feats = build_features(et, et1, et2, et3, industry, fuel, production, start_hour)
        next_pred = float(model.predict(feats)[0])
        next_pred = max(next_pred, 0.0)

        # --- Multi-step rolling forecast ---
        future = rolling_forecast(emissions, industry, fuel, production, steps, start_hour)

        # --- Compliance analysis ---
        if cap_kg is not None:
            cap = float(cap_kg)
            cumulative = sum(future)
            breach_step = next((i for i, v in enumerate(future) if v > cap), None)
            compliance = {
                "cap": cap,
                "cumulative_forecast": round(cumulative, 2),
                "breach_step": breach_step,
                "will_breach": breach_step is not None,
                "status": (
                    "WILL_BREACH"  if breach_step is not None else
                    "APPROACHING_CAP" if cumulative > cap * 0.85 else
                    "COMPLIANT"
                ),
            }
        elif cap_raw is not None:
            compliance = {
                "cap": None,
                "cumulative_forecast": round(sum(future), 2),
                "breach_step": None,
                "will_breach": False,
                "status": "INVALID_CAP",
            }
        else:
            avg = sum(future) / len(future) if future else 0
            compliance = {
                "cap": None,
                "cumulative_forecast": round(sum(future), 2),
                "breach_step": None,
                "will_breach": False,
                "status": "NO_CAP_SET",
                "avg_forecast": round(avg, 4),
            }

        # Trend direction
        if len(future) >= 2:
            trend_pct = ((future[-1] - future[0]) / future[0] * 100) if future[0] else 0
        else:
            trend_pct = 0

        return jsonify({
            "next":       round(next_pred, 4),
            "forecast":   future,
            "steps":      steps,
            "compliance": compliance,
            "trend_pct":  round(trend_pct, 2),
            "input_last": round(et, 4),
        })

    except Exception as e:
        log.error("Prediction error: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("PREDICT_PORT", 5001))
    log.info("Starting prediction service on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
