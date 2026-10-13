import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAttendance,
  calculateCgpa,
  calculatePercentage,
  countText,
  decodeUrlComponent,
  encodeUrlComponent,
  formatJson,
} from "../src/lib/student-utilities.ts";

test("marks percentage validates ranges and rounds to two decimal places", () => {
  assert.equal(calculatePercentage(420, 500), 84);
  assert.equal(calculatePercentage(1, 3), 33.33);
  assert.throws(() => calculatePercentage(2, 0), /greater than zero/);
  assert.throws(() => calculatePercentage(-1, 10), /between zero and total/);
  assert.throws(() => calculatePercentage(11, 10), /between zero and total/);
});

test("credit-weighted CGPA accounts for subject credits and validates grade points", () => {
  assert.equal(calculateCgpa([{ credits: 4, gradePoint: 9 }, { credits: 2, gradePoint: 6 }]), 8);
  assert.throws(() => calculateCgpa([]), /at least one subject/);
  assert.throws(() => calculateCgpa([{ credits: 3, gradePoint: 11 }]), /between 0 and 10/);
  assert.throws(() => calculateCgpa([{ credits: 0, gradePoint: 8 }]), /credits between 0 and 100/);
});

test("attendance calculates current percentage, target classes and safe skips", () => {
  assert.deepEqual(calculateAttendance(30, 40, 75), {
    currentPercent: 75,
    classesNeededToReachTarget: 0,
    classesCanSkip: 0,
  });
  assert.deepEqual(calculateAttendance(20, 40, 75), {
    currentPercent: 50,
    classesNeededToReachTarget: 40,
    classesCanSkip: 0,
  });
  assert.equal(calculateAttendance(9, 10, 75).classesCanSkip, 2);
  assert.equal(calculateAttendance(9, 10, 100).classesNeededToReachTarget, null);
  assert.throws(() => calculateAttendance(12, 10, 75), /whole class counts/);
  assert.throws(() => calculateAttendance(5, 10, 0), /Target attendance/);
});

test("text counter handles empty strings, Unicode, whitespace and reading time", () => {
  assert.deepEqual(countText(""), { words: 0, characters: 0, charactersWithoutSpaces: 0, lines: 0, readingMinutes: 0 });
  assert.deepEqual(countText("Hello   world\nनमस्ते"), {
    words: 3,
    characters: 21,
    charactersWithoutSpaces: 18,
    lines: 2,
    readingMinutes: 1,
  });
  assert.equal(countText(Array(401).fill("word").join(" ")).readingMinutes, 3);
});

test("JSON formatting produces pretty or compact valid JSON and clear errors", () => {
  assert.equal(formatJson('{"a":1,"b":[true,false]}'), '{\n  "a": 1,\n  "b": [\n    true,\n    false\n  ]\n}');
  assert.equal(formatJson('{"a":1}', true), '{"a":1}');
  assert.throws(() => formatJson('{"a":}'), /Invalid JSON/);
});

test("URL component encoding and decoding preserve Unicode and reject malformed escapes", () => {
  const original = "student notes & नमस्ते";
  assert.equal(decodeUrlComponent(encodeUrlComponent(original)), original);
  assert.equal(decodeUrlComponent("a+b%20c"), "a b c");
  assert.throws(() => decodeUrlComponent("%E0%A4"), /Invalid URL encoding/);
});
