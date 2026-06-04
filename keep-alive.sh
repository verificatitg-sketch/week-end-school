#!/bin/bash
cd /home/z/my-project
while true; do
  bun run start &
  PID=$!
  wait $PID
  echo "Server died, restarting in 3 seconds..."
  sleep 3
done
