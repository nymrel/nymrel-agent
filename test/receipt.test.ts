import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Text } from "../src/receipt.js";

test("canonical JSON and digests are stable across key order", () => {
  const left = canonicalJson({ beta: 2, alpha: { zed: 1, aye: 0 } });
  const right = canonicalJson({ alpha: { aye: 0, zed: 1 }, beta: 2 });
  assert.equal(left, right);
  assert.equal(sha256Text(left), sha256Text(right));
});
