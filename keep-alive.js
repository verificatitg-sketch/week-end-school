// WEDS Production Server Keep-Alive
// Restarts the server automatically if it crashes or gets killed
const { spawn } = require('child_process');
const http = require('http');

const MAX_RESTARTS = 100;
const RESTART_DELAY = 2000;
const HEALTH_CHECK_INTERVAL = 5000;
let restartCount = 0;
let currentChild = null;

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const healthy = await checkHealth();
    if (healthy) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function startServer() {
  if (restartCount >= MAX_RESTARTS) {
    console.log('[Keep-Alive] Max restarts reached. Exiting.');
    process.exit(1);
  }

  restartCount++;
  console.log(`[Keep-Alive] Starting production server (attempt ${restartCount}/${MAX_RESTARTS})...`);

  currentChild = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, HOSTNAME: '0.0.0.0', PORT: '3000' },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  currentChild.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  currentChild.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  currentChild.on('exit', (code, signal) => {
    console.log(`[Keep-Alive] Server exited with code=${code} signal=${signal}`);
    currentChild = null;
    setTimeout(startServer, RESTART_DELAY);
  });

  currentChild.on('error', (err) => {
    console.error(`[Keep-Alive] Failed to start: ${err.message}`);
    currentChild = null;
    setTimeout(startServer, RESTART_DELAY);
  });
}

// Health check loop
setInterval(async () => {
  if (!currentChild) return;
  
  const healthy = await checkHealth();
  if (!healthy) {
    console.log('[Keep-Alive] Health check failed! Killing server to trigger restart...');
    if (currentChild) {
      currentChild.kill('SIGTERM');
    }
  }
}, 30000);

startServer();

// Handle our own signals
process.on('SIGTERM', () => {
  console.log('[Keep-Alive] Received SIGTERM, shutting down...');
  if (currentChild) currentChild.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Keep-Alive] Received SIGINT, shutting down...');
  if (currentChild) currentChild.kill('SIGINT');
  process.exit(0);
});
