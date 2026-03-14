# Auto-apply worker: deployment and always-on runtime

The auto-apply worker runs in a **dedicated process** and executes `runAutoApplyWorker()` every **AUTO_APPLY_INTERVAL_MINUTES** (default 10). It acquires a lock, runs one apply cycle, persists heartbeat and run summary, then releases the lock.

## Env variables (production-safe)

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_APPLY_ENABLED` | true | If false, worker skips every tick. |
| `DRY_RUN_DEFAULT` | false | If true, no real applications are submitted. |
| `AUTO_APPLY_INTERVAL_MINUTES` | 10 | Minutes between worker ticks. |
| `AUTO_APPLY_LOCK_TIMEOUT_MINUTES` | 30 | Lock held longer than this is considered stale and released. |
| `WORKER_HEARTBEAT_TTL_MINUTES` | 25 | UI considers worker "not running" if no heartbeat for this long. |
| `MAX_APPLICATIONS_PER_RUN` | 10 | Max applications per cycle. |
| `MAX_APPLICATIONS_PER_DAY` | 20 | Daily cap (approximate, via ActivityLog). |

## How to run the worker

### 1. npm (same machine as app)

```bash
# Production (load .env from current directory)
npm run worker:auto-apply

# Dev (same; .env loaded via dotenv/config in script)
npm run worker:auto-apply:dev
```

The worker runs until you stop it (Ctrl+C). Use a process manager so it restarts on crash and survives logout.

---

### 2. PM2 (recommended on a VPS)

```bash
# Install PM2 if needed
npm i -g pm2

# Start worker (restarts on crash, logs to ~/.pm2/logs)
pm2 start npm --name "job-radar-worker" -- run worker:auto-apply

# Save process list so it restarts on reboot
pm2 save
pm2 startup
```

Other useful commands:

- `pm2 logs job-radar-worker` — tail logs  
- `pm2 restart job-radar-worker` — restart  
- `pm2 stop job-radar-worker` — stop  

---

### 3. Docker (worker as separate service)

Run the Next.js app in one container and the worker in another, sharing the same MongoDB and env.

**Dockerfile.worker** (example):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "run", "worker:auto-apply"]
```

**docker-compose.yml** (snippet):

```yaml
services:
  app:
    build: .
    command: npm start
    env_file: .env
    # ...

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    env_file: .env
    command: npm run worker:auto-apply
    depends_on:
      - app
```

Ensure `MONGODB_URI` and all apply/worker env vars are set in `.env` (or passed to the worker service).

---

### 4. Separate Node process on a VPS

1. SSH into the server.  
2. Clone/copy the app and install deps: `npm ci`.  
3. Create `.env` with `MONGODB_URI`, `AUTO_APPLY_ENABLED`, `DRY_RUN_DEFAULT`, etc.  
4. Run the worker in the background:

   ```bash
   nohup npm run worker:auto-apply > worker.log 2>&1 &
   ```

   Or use **systemd** (recommended):

   **/etc/systemd/system/job-radar-worker.service**:

   ```ini
   [Unit]
   Description=Job Radar AI auto-apply worker
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/path/to/Job-Radar-AI
   ExecStart=/usr/bin/npm run worker:auto-apply
   Restart=on-failure
   RestartSec=30
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

   Then:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable job-radar-worker
   sudo systemctl start job-radar-worker
   sudo systemctl status job-radar-worker
   ```

---

### 5. Raspberry Pi (background process)

Same as “separate Node process”: install Node, clone the app, set `.env`, then either:

- **nohup**: `nohup npm run worker:auto-apply >> /var/log/job-radar-worker.log 2>&1 &`  
- **systemd**: use the same unit file as above, with `User=pi` and correct `WorkingDirectory`.

---

## Verifying it’s running

1. **Operations page** (`/operations/auto-apply`)  
   - If the worker is running and sending heartbeats, the “Auto-apply worker is not running” warning goes away.  
   - “Worker heartbeat status” shows the last heartbeat time.

2. **GET /api/debug/auto-apply**  
   - Response includes a `worker` object: `workerRunning`, `lastHeartbeatAt`, `lastRunStartedAt`, `lastRunCompletedAt`, `lockActive`, `staleLockDetected`, `queuedCount`, `attemptedToday`, `appliedToday`, `failedToday`.

3. **Manual trigger**  
   - Use “Run auto-apply now (one cycle)” on `/operations/auto-apply` to run the same logic once without the scheduler.

---

## Stale lock recovery

If the worker process dies while holding the lock, the lock stays “active” until:

- Another process (e.g. next worker tick or manual trigger) runs and sees that the lock’s **heartbeat** is older than **AUTO_APPLY_LOCK_TIMEOUT_MINUTES**.  
- It then releases the lock and logs: `[JobRadarWorker] stale lock released`.  
- The same process then tries to acquire the lock and runs a normal cycle.

No manual intervention is required; the next run recovers automatically.
