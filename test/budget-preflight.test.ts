import test from "node:test";
import assert from "node:assert/strict";
import { preflightDeadline, preflightResearchFanout } from "../budget-preflight.ts";
import { getRuntimeConfig } from "../runtime-config.ts";

test("budget preflight caps research fan-out and accepts no daily quota", () => {
  assert.deepEqual(preflightResearchFanout(["a", "b", "c", "d"]), { providers: ["a", "b", "c"], omitted: 1, max_fanout: 3 });
});

test("budget preflight applies operator deadline ceiling", () => {
  assert.equal(preflightDeadline(90, 20), 20);
  assert.throws(() => preflightDeadline(0, 20), /deadline_seconds must be a positive integer/);
  assert.throws(() => preflightDeadline(20, 30.9), /operator deadline ceiling must be a positive integer/);
  assert.equal(getRuntimeConfig({ extractDeadlineSeconds: 30.9 }).extractDeadlineSeconds, 30);
});
