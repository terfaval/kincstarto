import test from "node:test";
import assert from "node:assert/strict";
import { explicitShioriRelated } from "../../src/lib/shioriDetail.ts";

const books = [
  { id: "a", related: ["c", "b", "c", "missing", "a"] },
  { id: "b", related: [] },
  { id: "c" },
  { id: "d", related: ["a"] },
  { id: "e" },
];
test("explicit relationships preserve order and avoid duplicates or missing IDs", () => {
  assert.deepEqual(explicitShioriRelated(books[0], books).map((book) => book.id), ["c", "b"]);
});
test("books without explicit relationships have none, even with other books available", () => {
  assert.deepEqual(explicitShioriRelated(books[1], books), []);
  assert.deepEqual(explicitShioriRelated(books[2], books), []);
});
test("only first four explicit links are shown", () => {
  const source = { id: "source", related: ["a", "b", "c", "d", "e"] };
  assert.deepEqual(explicitShioriRelated(source, books).map((book) => book.id), ["a", "b", "c", "d"]);
});
