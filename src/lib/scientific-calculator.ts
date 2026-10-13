export type AngleMode = "deg" | "rad";

type Token = { type: "number"; value: number } | { type: "name"; value: string } | { type: "operator"; value: string } | { type: "left" | "right" | "comma" };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/u.test(ch)) { i++; continue; }
    const rest = source.slice(i);
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iu);
    if (number) { const value = Number(number[0]); if (!Number.isFinite(value)) throw new Error("Number is outside the supported range."); tokens.push({ type: "number", value }); i += number[0].length; continue; }
    const name = rest.match(/^[a-z_][a-z_0-9]*/iu);
    if (name) { tokens.push({ type: "name", value: name[0].toLowerCase() }); i += name[0].length; continue; }
    if ("+-*/^%!".includes(ch)) { tokens.push({ type: "operator", value: ch }); i++; continue; }
    if (ch === "(") { tokens.push({ type: "left" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "right" }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "comma" }); i++; continue; }
    throw new Error("Unsupported character: " + ch);
  }
  if (!tokens.length) throw new Error("Enter a calculation first.");
  return tokens;
}

export function calculateScientificExpression(source: string, angleMode: AngleMode = "deg"): number {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (type: Token["type"]) => { const token = take(); if (!token || token.type !== type) throw new Error("Check the expression's brackets and operators."); return token; };
  const toRadians = (value: number) => angleMode === "deg" ? value * Math.PI / 180 : value;
  const fromRadians = (value: number) => angleMode === "deg" ? value * 180 / Math.PI : value;

  function expression(): number {
    let value = term();
    while (peek()?.type === "operator" && ["+", "-"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const right = term(); value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  function term(): number {
    let value = unary();
    while (peek()?.type === "operator" && ["*", "/"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const right = unary();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero.");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function unary(): number {
    if (peek()?.type === "operator" && ["+", "-"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const value = unary(); return op === "-" ? -value : value;
    }
    return power();
  }
  function power(): number {
    let value = primary();
    if (peek()?.type === "operator" && (peek() as Extract<Token,{type:"operator"}>).value === "^") {
      take(); value = Math.pow(value, unary());
    }
    while (peek()?.type === "operator" && ["!", "%"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      if (op === "%") value /= 100;
      else {
        if (value < 0 || !Number.isInteger(value) || value > 170) throw new Error("Factorial requires a whole number from 0 to 170.");
        let result = 1; for (let n = 2; n <= value; n++) result *= n; value = result;
      }
    }
    return value;
  }
  function primary(): number {
    const token = take();
    if (!token) throw new Error("The expression is incomplete.");
    if (token.type === "number") return token.value;
    if (token.type === "left") { const value = expression(); expect("right"); return value; }
    if (token.type !== "name") throw new Error("Expected a number, constant or function.");
    if (token.value === "pi" || token.value === "π") return Math.PI;
    if (token.value === "e") return Math.E;
    if (peek()?.type !== "left") throw new Error("Unknown constant or function: " + token.value);
    take();
    const args = [expression()];
    while (peek()?.type === "comma") { take(); args.push(expression()); }
    expect("right");
    const x = args[0];
    if (args.length !== 1 && token.value !== "pow") throw new Error(token.value + " expects one argument.");
    const funcs: Record<string, () => number> = {
      sin: () => Math.sin(toRadians(x)), cos: () => Math.cos(toRadians(x)), tan: () => Math.tan(toRadians(x)),
      asin: () => fromRadians(Math.asin(x)), acos: () => fromRadians(Math.acos(x)), atan: () => fromRadians(Math.atan(x)),
      sqrt: () => { if (x < 0) throw new Error("Square root needs a non-negative number."); return Math.sqrt(x); },
      abs: () => Math.abs(x), ln: () => { if (x <= 0) throw new Error("ln requires a number greater than zero."); return Math.log(x); },
      log: () => { if (x <= 0) throw new Error("log requires a number greater than zero."); return Math.log10(x); },
      exp: () => Math.exp(x), floor: () => Math.floor(x), ceil: () => Math.ceil(x), round: () => Math.round(x),
      pow: () => { if (args.length !== 2) throw new Error("pow expects two arguments."); return Math.pow(args[0], args[1]); },
    };
    const fn = funcs[token.value];
    if (!fn) throw new Error("Unsupported function: " + token.value);
    return fn();
  }

  const result = expression();
  if (position !== tokens.length) throw new Error("Unexpected extra input. Check operators and brackets.");
  if (!Number.isFinite(result)) throw new Error("Result is outside the supported numeric range.");
  return Object.is(result, -0) ? 0 : result;
}
