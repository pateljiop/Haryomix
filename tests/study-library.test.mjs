import test from "node:test";
import assert from "node:assert/strict";
import {
  filterStudyResources,
  isStudyResource,
  parseStudyLibraryBackup,
  sortStudyResources,
} from "../src/lib/study-library.ts";

function resource(overrides = {}) {
  return {
    id: "item-1",
    title: "Database revision notes",
    kind: "note",
    content: "Normalization, keys and relational design.",
    tags: ["BCA", "DBMS"],
    sourceUrl: "",
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

test("study resource validator accepts notes, resources and secure HTTP links", () => {
  assert.equal(isStudyResource(resource()), true);
  assert.equal(isStudyResource(resource({ kind: "resource", content: "Key points to revise." })), true);
  assert.equal(isStudyResource(resource({ kind: "link", content: "", sourceUrl: "https://example.com/notes" })), true);
});

test("study resource validator rejects unsafe URLs, invalid tags, invalid timestamps and oversized fields", () => {
  assert.equal(isStudyResource(resource({ kind: "link", sourceUrl: "javascript:alert(1)" })), false);
  assert.equal(isStudyResource(resource({ kind: "link", sourceUrl: "" })), false);
  assert.equal(isStudyResource(resource({ sourceUrl: "data:text/html,unsafe" })), false);
  assert.equal(isStudyResource(resource({ tags: ["DBMS", " dbms "] })), false);
  assert.equal(isStudyResource(resource({ updatedAt: 99 })), false);
  assert.equal(isStudyResource(resource({ title: "x" })), false);
  assert.equal(isStudyResource(resource({ content: "x".repeat(100001) })), false);
  assert.equal(isStudyResource(resource({ tags: Array.from({ length: 13 }, (_, i) => "tag" + i) })), false);
});

test("backup parser rejects malformed JSON, wrong shape, invalid items, duplicates and excessive size", () => {
  assert.deepEqual(parseStudyLibraryBackup(JSON.stringify([resource()])), [resource()]);
  assert.throws(() => parseStudyLibraryBackup("{"), /not valid JSON/);
  assert.throws(() => parseStudyLibraryBackup(JSON.stringify({ items: [resource()] })), /resource list/);
  assert.throws(() => parseStudyLibraryBackup(JSON.stringify([resource(), resource()])), /duplicate item IDs/);
  assert.throws(() => parseStudyLibraryBackup(JSON.stringify([resource({ sourceUrl: "javascript:bad" })])), /invalid note or resource/);
  assert.throws(() => parseStudyLibraryBackup(JSON.stringify(Array.from({ length: 501 }, (_, i) => resource({ id: "item-" + i })))), /up to 500/);
});

test("library sorting shows recently updated items first with stable title tie-break", () => {
  const items = [
    resource({ id: "old", title: "Zebra", updatedAt: 100 }),
    resource({ id: "new", title: "Beta", updatedAt: 300 }),
    resource({ id: "tie", title: "Alpha", updatedAt: 300 }),
  ];
  assert.deepEqual(sortStudyResources(items).map(item => item.id), ["tie", "new", "old"]);
});

test("library search matches title, content, source URL and tags and respects type filter", () => {
  const items = [
    resource({ id: "dbms", tags: ["BCA", "DBMS"] }),
    resource({ id: "web", title: "Useful web resource", kind: "resource", content: "CSS layout notes", tags: ["frontend"] }),
    resource({ id: "link", title: "Lecture recording", kind: "link", content: "", sourceUrl: "https://example.com/os", tags: ["operating systems"] }),
  ];
  assert.deepEqual(filterStudyResources(items, "dbms").map(item => item.id), ["dbms"]);
  assert.deepEqual(filterStudyResources(items, "css", "resource").map(item => item.id), ["web"]);
  assert.deepEqual(filterStudyResources(items, "example.com").map(item => item.id), ["link"]);
  assert.deepEqual(filterStudyResources(items, "", "note").map(item => item.id), ["dbms"]);
});
