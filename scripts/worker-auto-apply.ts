/**
 * Production auto-apply worker: runs runAutoApplyWorker every AUTO_APPLY_INTERVAL_MINUTES.
 * Start with: npm run worker:auto-apply (production) or npm run worker:auto-apply:dev (with dotenv).
 */
import "dotenv/config";

import { runAutoApplyWorker } from "@/services/autoApply/worker";
import { getApplyConfig, getWorkerConfig } from "@/config/applyConfig";

const LOG = "[JobRadarWorker]";

async function tick(): Promise<void> {
  console.log(`${LOG} cron tick start`);
  try {
    const { ran, skippedReason } = await runAutoApplyWorker();
    if (!ran && skippedReason) {
      console.log(`${LOG} tick skipped: ${skippedReason}`);
    }
  } catch (err) {
    console.error(`${LOG} tick error:`, err);
  }
}

function main(): void {
  const applyConfig = getApplyConfig();
  const workerConfig = getWorkerConfig();

  console.log(
    `${LOG} worker booted | AUTO_APPLY_ENABLED=${applyConfig.autoApplyEnabled} DRY_RUN_DEFAULT=${applyConfig.dryRunDefault} interval=${workerConfig.intervalMinutes}m lockTimeout=${workerConfig.lockTimeoutMinutes}m`
  );

  if (!applyConfig.autoApplyEnabled) {
    console.log(`${LOG} worker skipped because disabled`);
    return;
  }

  const intervalMs = workerConfig.intervalMinutes * 60 * 1000;

  tick();
  setInterval(tick, intervalMs);
}

main();
