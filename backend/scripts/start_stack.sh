#!/usr/bin/env bash
set -euo pipefail

# Starts the full demo stack:
# 1) emissionSimulator (1‑min readings)
# 2) emissionBatchSubmitter (10‑min window submitted every minute)
# 3) prediction_service (XGBoost) — starts after a small delay so at least 4 readings exist
# Logs for node scripts go to scripts/logs/*.log; model stays in the foreground for live output.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
LOG_DIR="$SCRIPTS_DIR/logs"
PREDICT_DELAY_SEC=${PREDICT_DELAY_SEC:-60}   # default: wait ~1 min (≈1 reading per min)

mkdir -p "$LOG_DIR"

# Cleanup on exit
pids=()
cleanup() {
  echo "\n[stack] Stopping background services..." >&2
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

# 1) Start emission simulator (background, stdout/stderr to this terminal)
echo "[stack] Starting emission simulator (live output follows)" >&2
node "$SCRIPTS_DIR/emissionSimulator.js" &
pids+=("$!")

# 2) Start batch submitter (background, stdout/stderr to this terminal)
echo "[stack] Starting emission batch submitter (live output follows)" >&2
node "$SCRIPTS_DIR/emissionBatchSubmitter.js" &
pids+=("$!")

# 3) Delay, then start prediction service in the foreground so you can see predictions
if [[ "$PREDICT_DELAY_SEC" -gt 0 ]]; then
  echo "[stack] Waiting ${PREDICT_DELAY_SEC}s before starting prediction_service (to collect ≥4 readings)..." >&2
  sleep "$PREDICT_DELAY_SEC"
fi

echo "[stack] Starting prediction_service (foreground; ctrl+c stops all)" >&2
cd "$SCRIPTS_DIR"
if [[ -f venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi
exec python3 "$SCRIPTS_DIR/prediction_service.py"
