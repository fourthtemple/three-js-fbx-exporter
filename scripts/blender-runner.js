import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_BLENDER_PATH = "/Applications/Blender.app/Contents/MacOS/Blender";
const BLENDER_LOCK_DIR = join(tmpdir(), "fbx-exporter-blender.lock");
const BLENDER_LOCK_WAIT_MS = 100;
const BLENDER_LOCK_TIMEOUT_MS = 120000;
const BLENDER_LOCK_STALE_MS = 300000;
const BLENDER_RETRY_COUNT = 2;
const BLENDER_RETRY_DELAY_MS = 750;

export function assertCanRunBlender() {
  if (process.env.CODEX_SANDBOX) {
    throw new Error(
      "Blender validation cannot run inside the Codex filesystem sandbox. " +
      "Run this npm script with external permissions so Blender can start normally."
    );
  }
}

export function blenderBackgroundArgs(script, fbxPath) {
  return [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "-noaudio",
    "--debug-gpu-force-workarounds",
    "--python-exit-code",
    "1",
    "--python-expr",
    script,
    "--",
    fbxPath
  ];
}

export function blenderExecutablePath() {
  return process.env.BLENDER_PATH || DEFAULT_BLENDER_PATH;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeStaleLock(now) {
  try {
    const stats = statSync(BLENDER_LOCK_DIR);
    if (now - stats.mtimeMs > BLENDER_LOCK_STALE_MS) {
      rmSync(BLENDER_LOCK_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function acquireBlenderLock({ timeoutMs = BLENDER_LOCK_TIMEOUT_MS } = {}) {
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(BLENDER_LOCK_DIR);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }

    const now = Date.now();
    removeStaleLock(now);
    if (now - started > timeoutMs) {
      throw new Error(`Timed out waiting for Blender validation lock: ${BLENDER_LOCK_DIR}`);
    }
    sleepSync(BLENDER_LOCK_WAIT_MS);
  }
}

function releaseBlenderLock() {
  rmSync(BLENDER_LOCK_DIR, { recursive: true, force: true });
}

function retryCount(options) {
  const rawCount = options.retryCount ?? process.env.BLENDER_VALIDATION_RETRIES ?? BLENDER_RETRY_COUNT;
  const count = Number(rawCount);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : BLENDER_RETRY_COUNT;
}

function retryDelayMs(options) {
  const rawDelay = options.retryDelayMs ?? process.env.BLENDER_VALIDATION_RETRY_DELAY_MS ?? BLENDER_RETRY_DELAY_MS;
  const delay = Number(rawDelay);
  return Number.isFinite(delay) ? Math.max(0, Math.trunc(delay)) : BLENDER_RETRY_DELAY_MS;
}

export function isRetryableBlenderCrash(result) {
  return !result.error && (
    result.signal === "SIGSEGV" ||
    result.signal === "SIGABRT" ||
    result.status === 11 ||
    result.status === 134
  );
}

export function runBlenderBackground(script, fbxPath, options = {}) {
  assertCanRunBlender();
  const blenderPath = options.blenderPath || blenderExecutablePath();
  if (!existsSync(blenderPath)) {
    throw new Error(`Blender executable not found: ${blenderPath}`);
  }

  const spawnBlender = options.spawnSync || spawnSync;
  const retries = retryCount(options);
  const delayMs = retryDelayMs(options);

  acquireBlenderLock(options);
  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const result = {
        ...spawnBlender(blenderPath, blenderBackgroundArgs(script, fbxPath), {
          encoding: "utf8",
          ...options.spawnOptions
        }),
        blenderAttempts: attempt + 1
      };
      if (!isRetryableBlenderCrash(result) || attempt === retries) {
        return result;
      }
      if (delayMs > 0) {
        sleepSync(delayMs);
      }
    }
  } finally {
    releaseBlenderLock();
  }
}

export function formatBlenderFailure(result, fbxPath) {
  const details = [
    `Blender failed while importing ${fbxPath}.`
  ];

  if (result.error) {
    details.push(`spawn error: ${result.error.message}`);
  }
  if (result.signal) {
    details.push(`signal: ${result.signal}`);
  }
  if (result.status !== null && result.status !== undefined) {
    details.push(`exit status: ${result.status}`);
  }
  if (result.blenderAttempts > 1) {
    details.push(`attempts: ${result.blenderAttempts}`);
  }

  const stderr = result.stderr?.trim();
  if (stderr) {
    details.push(`stderr:\n${stderr}`);
  }

  const stdout = result.stdout?.trim();
  if (stdout) {
    details.push(`stdout:\n${stdout}`);
  }

  return details.join("\n\n");
}

export function assertBlenderSucceeded(result, fbxPath) {
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(formatBlenderFailure(result, fbxPath));
  }
}
