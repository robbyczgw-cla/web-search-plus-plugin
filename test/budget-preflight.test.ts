import test from "node:test";
import assert from "node:assert/strict";
import { preflightDeadline, preflightResearchFanout } from "../budget-preflight.ts";

test("budget preflight caps research fan-out and accepts no daily quota", () => {
  assert.deepEqual(preflightResearchFanout(["a", "b", "c", "d"]), { providers: ["a", "b", "c"], omitted: 1, max_fanout: 3 });
});

test("budget preflight applies operator deadline ceiling", () => {
  assert.equal(preflightDeadline(90, 20), 20);
  assert.throws(() => preflightDeadline(0, 20), /positive integer/);
});
