#!/bin/bash
# WEDS Keep-Alive Server Script
# Runs next start in production mode and auto-restarts on crash
while true; do
    echo "[$(date)] Starting WEDS server..."
    cd /home/z/my-project
    node node_modules/next/dist/bin/next start -p 3000 2>&1
    EXIT=$?
    echo "[$(date)] Server exited with code $EXIT. Restarting in 3s..."
    sleep 3
done
