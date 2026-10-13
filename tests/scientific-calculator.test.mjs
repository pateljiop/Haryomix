import test from "node:test";
import assert from "node:assert/strict";
import { calculateScientificExpression as calc } from "../src/lib/scientific-calculator.ts";

test("evaluates arithmetic with precedence and parentheses", () => {
  assert.equal(calc("2 + 3 * 4"), 14);
  assert.equal(calc("(2 + 3) * 4"), 20);
  assert.equal(calc("2^3^2"), 512);
});
test("supports scientific functions, constants and degree mode", () => {
  assert.equal(calc("sqrt(81) + log(100)"), 11);
  assert.equal(calc("sin(30)"), 0.49999999999999994);
  assert.equal(calc("cos(0)"), 1);
  assert.ok(Math.abs(calc("pi") - Math.PI) < 1e-12);
  assert.equal(calc("sin(pi/2)", "rad"), 1);
});
test("supports factorial and percent postfix", () => {
  assert.equal(calc("5!"), 120);
  assert.equal(calc("25%"), 0.25);
  assert.equal(calc("pow(2, 4)"), 16);
});
test("rejects invalid and unsafe expressions clearly", () => {
  assert.throws(() => calc("1/0"), /divide by zero/i);
  assert.throws(() => calc("sqrt(-1)"), /non-negative/i);
  assert.throws(() => calc("2 +"), /incomplete|Expected/i);
  assert.throws(() => calc("window.alert(1)"), /Unsupported character|Unknown constant/i);
  assert.throws(() => calc("171!"), /Factorial requires/i);
});
