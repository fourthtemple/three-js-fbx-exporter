import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertBlenderSucceeded,
  blenderBackgroundArgs,
  blenderExecutablePath,
  formatBlenderFailure,
  isRetryableBlenderCrash,
  runBlenderBackground
} from "../scripts/blender-runner.js";

test("starts Blender validators with GPU workarounds enabled", () => {
  assert.deepEqual(blenderBackgroundArgs("print('ok')", "/tmp/model.fbx"), [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "-noaudio",
    "--debug-gpu-force-workarounds",
    "--python-exit-code",
    "1",
    "--python-expr",
    "print('ok')",
    "--",
    "/tmp/model.fbx"
  ]);
});

test("uses BLENDER_PATH override for validator launches", () => {
  const previous = process.env.BLENDER_PATH;
  process.env.BLENDER_PATH = "/tmp/custom-blender";
  try {
    assert.equal(blenderExecutablePath(), "/tmp/custom-blender");
  } finally {
    if (previous === undefined) {
      delete process.env.BLENDER_PATH;
    } else {
      process.env.BLENDER_PATH = previous;
    }
  }
});

test("formats Blender crashes with signal, status, and captured output", () => {
  const message = formatBlenderFailure({
    error: null,
    signal: "SIGSEGV",
    status: null,
    stderr: "segmentation fault",
    stdout: "startup log"
  }, "/tmp/crash.fbx");

  assert.match(message, /crash\.fbx/);
  assert.match(message, /SIGSEGV/);
  assert.match(message, /segmentation fault/);
  assert.match(message, /startup log/);
});

test("identifies transient Blender process crashes as retryable", () => {
  assert.equal(isRetryableBlenderCrash({
    error: null,
    signal: "SIGSEGV",
    status: null
  }), true);
  assert.equal(isRetryableBlenderCrash({
    error: null,
    signal: null,
    status: 11
  }), true);
  assert.equal(isRetryableBlenderCrash({
    error: new Error("spawn failed"),
    signal: null,
    status: null
  }), false);
});

test("retries Blender startup crashes before returning the result", () => {
  const calls = [];
  const result = runBlenderBackground("print('ok')", "/tmp/model.fbx", {
    blenderPath: "/bin/echo",
    retryCount: 2,
    retryDelayMs: 0,
    spawnSync: (...args) => {
      calls.push(args);
      if (calls.length === 1) {
        return {
          error: null,
          signal: "SIGSEGV",
          status: null,
          stderr: "startup crash",
          stdout: ""
        };
      }
      return {
        error: null,
        signal: null,
        status: 0,
        stderr: "",
        stdout: "ok"
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.status, 0);
  assert.equal(result.blenderAttempts, 2);
});

test("throws a formatted error when Blender exits unsuccessfully", () => {
  assert.throws(() => {
    assertBlenderSucceeded({
      error: null,
      signal: null,
      status: 11,
      stderr: "",
      stdout: ""
    }, "/tmp/bad.fbx");
  }, /exit status: 11/);
});
