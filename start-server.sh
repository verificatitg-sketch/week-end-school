#!/bin/bash
while true; do
    echo "[$(date)] Starting Next.js server..."
    node node_modules/.bin/next start -p 3000
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
    sleep 3
done
