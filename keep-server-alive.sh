#!/bin/bash
while true; do
    echo "[$(date)] Starting server..."
    cd /home/z/my-project
    node node_modules/next/dist/bin/next start -p 3000 2>&1
    EXIT=$?
    echo "[$(date)] Server exited with code $EXIT. Restarting in 2s..."
    sleep 2
done
