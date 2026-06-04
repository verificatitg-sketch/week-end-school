#!/bin/bash
# WEDS Server Auto-Restart Loop
# Runs as a persistent process that restarts the Next.js production server
# whenever it dies

cd /home/z/my-project

LOG="/home/z/my-project/dev.log"
echo "[$(date)] WEDS server auto-restart loop started" >> "$LOG"

while true; do
  echo "[$(date)] Starting Next.js production server..." >> "$LOG"
  
  HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js 2>&1 | while IFS= read -r line; do
    echo "$line" >> "$LOG"
  done
  
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2s..." >> "$LOG"
  sleep 2
done
