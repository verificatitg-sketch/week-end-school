#!/bin/bash
# WEDS Dev Server Keep-Alive Script
# Auto-restarts the Next.js dev server if it crashes

LOG_FILE="/home/z/my-project/dev.log"
MAX_RESTARTS=10
RESTART_COUNT=0
RESTART_DELAY=3

echo "[Keep-Alive] Starting WEDS dev server monitor..." | tee -a "$LOG_FILE"

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  echo "[Keep-Alive] Starting dev server (attempt $((RESTART_COUNT + 1))/$MAX_RESTARTS)..." | tee -a "$LOG_FILE"
  
  cd /home/z/my-project
  NODE_OPTIONS="--max-old-space-size=512" npx next dev -p 3000 2>&1 | tee -a "$LOG_FILE"
  
  EXIT_CODE=$?
  echo "[Keep-Alive] Server exited with code $EXIT_CODE" | tee -a "$LOG_FILE"
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[Keep-Alive] Clean exit, not restarting." | tee -a "$LOG_FILE"
    break
  fi
  
  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "[Keep-Alive] Restarting in ${RESTART_DELAY}s..." | tee -a "$LOG_FILE"
  sleep $RESTART_DELAY
done

echo "[Keep-Alive] Max restarts reached or clean exit. Stopping monitor." | tee -a "$LOG_FILE"
