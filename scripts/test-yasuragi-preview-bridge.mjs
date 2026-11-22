import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toClientPosePreviews } from "../src/features/yasuragi/lib/practice-preview-bridge.ts";

test("null-prototype server preview map becomes a plain Client Component prop", () => {
  const source = Object.create(null);
  source.pose_mountain_pose = {
    id: "pose_mountain_pose", name: "Hegyállás", sanskrit: null,
    imageUrl: "/image", setup: "Talpak lent", modifications: [],
    cautionAreas: [], validated: false,
  };
  const result = toClientPosePreviews(source);
  assert.equal(Object.getPrototypeOf(source), null);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.notStrictEqual(result, source);
  assert.deepEqual(result.pose_mountain_pose, source.pose_mountain_pose);
  assert.doesNotThrow(() => structuredClone(result));
});

test("conversion preserves safe dictionary keys without prototype mutation", () => {
  const source = Object.create(null);
  source.constructor = { id: "constructor" };
  source.__proto__ = { id: "__proto__" };
  const result = toClientPosePreviews(source);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, "constructor"), true);
  assert.equal(Object.hasOwn(result, "__proto__"), true);
  assert.equal(result.__proto__.id, "__proto__");
});

test("pose library uses the serializable preview bridge on return", () => {
  const source = readFileSync("src/features/yasuragi/lib/practice-library.ts", "utf8");
  assert.match(source, /import \{ toClientPosePreviews \} from "\.\/practice-preview-bridge"/);
  assert.match(source, /return toClientPosePreviews\(previews\);/);
});
