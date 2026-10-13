import test from "node:test";
import assert from "node:assert/strict";
import { convertUnit } from "../src/lib/unit-converter.ts";

test("converts length, mass, area, volume and speed locally", () => {
  assert.equal(convertUnit(1, "length", "km", "m"), 1000);
  assert.equal(convertUnit(1, "mass", "kg", "g"), 1000);
  assert.equal(convertUnit(1, "area", "ha", "m2"), 10000);
  assert.ok(Math.abs(convertUnit(1, "volume", "gal", "l") - 3.785411784) < 1e-9);
  assert.equal(convertUnit(36, "speed", "kmh", "ms"), 10);
});
test("converts temperature with offsets", () => {
  assert.equal(convertUnit(0, "temperature", "C", "F"), 32);
  assert.equal(convertUnit(100, "temperature", "C", "K"), 373.15);
  assert.equal(convertUnit(32, "temperature", "F", "C"), 0);
});
test("converts time and binary storage units", () => {
  assert.equal(convertUnit(2, "time", "h", "min"), 120);
  assert.equal(convertUnit(1, "storage", "GB", "MB"), 1024);
  assert.equal(convertUnit(1024, "storage", "KB", "B"), 1048576);
});
test("rejects invalid input and mismatched units", () => {
  assert.throws(() => convertUnit(Number.NaN, "length", "m", "km"), /finite number/i);
  assert.throws(() => convertUnit(1, "length", "m", "kg"), /selected category/i);
});
