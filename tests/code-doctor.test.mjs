import test from "node:test";
import assert from "node:assert/strict";
import { inspectCode } from "../src/lib/code-doctor.ts";

test("Code Doctor catches missing Python colons and unclosed parentheses", () => {
  const findings = inspectCode("def add(a, b)\n    return a + b\n\nprint(add(2, 3)", "Python");
  assert.ok(findings.some(item => item.includes("Line 1") && item.includes("colon")));
  assert.ok(findings.some(item => item.includes("Unclosed bracket")));
});

test("Code Doctor ignores brackets and comment markers inside Python strings and comments", () => {
  const findings = inspectCode('message = "not a closing ) or # comment"\n# ignore this ]\nprint(message)', "Python");
  assert.deepEqual(findings, ["No obvious pattern-based issue found. This is not a compiler or code execution."]);
});

test("Code Doctor reports mismatched JavaScript brackets with the line number", () => {
  const findings = inspectCode("function run() {\n  return [1, 2);\n}", "JavaScript");
  assert.ok(findings.some(item => item.includes("Line 2") && item.includes("closing )")));
});

test("Code Doctor ignores delimiters in JavaScript comments and quoted strings", () => {
  const findings = inspectCode('const message = "close ) and // are text"; // ignore ]\n/* ignore } */\nconsole.log(message);', "JavaScript");
  assert.ok(findings.includes("Review console.log calls before submitting."));
  assert.equal(findings.some(item => item.includes("closing") || item.includes("Unclosed")), false);
});

test("Code Doctor flags loose equality and TODO markers without claiming code was executed", () => {
  const findings = inspectCode("if (value == 2) { // TODO verify\n  return true;\n}", "JavaScript");
  assert.ok(findings.some(item => item.includes("Loose equality")));
  assert.ok(findings.some(item => item.includes("TODO/FIXME")));
  assert.equal(findings.some(item => item.includes("No obvious pattern-based issue")), false);
});

test("Code Doctor handles empty input without a misleading success message", () => {
  assert.deepEqual(inspectCode("  \n", "Python"), ["Paste code first."]);
});
