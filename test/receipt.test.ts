import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Text } from "../src/receipt.js";

test("canonical JSON and digests are stable across key order", () => {
  const left = canonicalJson({ z: 3, Z: 2, alpha: { zed: 1, aye: 0 } });
  const right = canonicalJson({ alpha: { aye: 0, zed: 1 }, Z: 2, z: 3 });
  assert.equal(left, right);
  assert.equal(left, '{"Z":2,"alpha":{"aye":0,"zed":1},"z":3}');
  assert.equal(sha256Text(left), sha256Text(right));
});
