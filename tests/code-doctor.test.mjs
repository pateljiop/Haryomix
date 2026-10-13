import test from "node:test";
import assert from "node:assert/strict";
import { inspectCode } from "../src/lib/code-doctor.ts";

test("Code Doctor asks for code when the input is empty", () => {
  assert.deepEqual(inspectCode("   ", "Python"), ["Paste code first."]);
});

test("Code Doctor detects common Python block-colon errors with line numbers", () => {
  const findings = inspectCode("def add(a, b)\n    return a + b", "Python");
  assert.ok(findings.some(finding => finding.includes("Line 1") && finding.includes("colon")));
});

test("Code Doctor detects mismatched and unclosed JavaScript brackets", () => {
  const findings = inspectCode("function run() {\n  return [1, 2);\n}", "JavaScript");
  assert.ok(findings.some(finding => finding.includes("closing ) may not match")));
});

test("Code Doctor detects missing string quotes and risky loose equality", () => {
  const findings = inspectCode('const answer = "hello; if (value == 2) { console.log(answer); }', "JavaScript");
  assert.ok(findings.some(finding => finding.includes("missing its closing quote")));
  assert.ok(findings.some(finding => finding.includes("Loose equality")));
});

test("Code Doctor is honest when it finds no obvious pattern", () => {
  assert.deepEqual(inspectCode("print(2 + 2)", "Python"), [
    "No obvious pattern-based issue found. This is not a compiler or code execution.",
  ]);
});
