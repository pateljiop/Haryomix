export type CodeLanguage = "Python" | "JavaScript" | "Java" | "C" | "C++";

function stripLineComment(line: string, language: CodeLanguage): string {
  let quote = "";
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || (char === "`" && language === "JavaScript")) {
      quote = char;
      continue;
    }
    if (language === "Python" && char === "#") return line.slice(0, i);
    if (language !== "Python" && char === "/" && (line[i + 1] === "/" || line[i + 1] === "*")) return line.slice(0, i);
  }
  return line;
}

export function inspectCode(code: string, language: CodeLanguage): string[] {
  if (!code.trim()) return ["Paste code first."];

  const findings: string[] = [];
  const lines = code.split(/\r\n|\r|\n/u);
  if (language === "Python") {
    lines.forEach((line, index) => {
      const source = stripLineComment(line, language);
      const trimmed = source.trim();
      if (!trimmed) return;
      if (/^(?:async\s+)?(?:if|elif|else|for|while|def|class|try|except|finally|with|match|case)\b/u.test(trimmed) && !trimmed.endsWith(":")) {
        findings.push(`Line ${index + 1}: Python block statements usually end with a colon.`);
      }
      const indentation = line.match(/^[ \t]+/u)?.[0] ?? "";
      if (indentation.includes("\t") && indentation.includes(" ")) {
        findings.push(`Line ${index + 1}: mixed tabs and spaces may cause indentation errors.`);
      }
    });
  }

  const stack: { bracket: string; line: number }[] = [];
  let quote = "";
  let quoteLine = 1;
  let escaped = false;
  let blockComment = false;
  let line = 1;
  const expected: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (char === "\n") line++;
    if (language !== "Python" && blockComment) {
      if (char === "*" && next === "/") { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = "";
      continue;
    }
    if (language === "Python" && char === "#") {
      while (i < code.length && code[i] !== "\n") i++;
      if (i < code.length) line++;
      continue;
    }
    if (language !== "Python" && char === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      if (i < code.length) line++;
      continue;
    }
    if (language !== "Python" && char === "/" && next === "*") {
      blockComment = true; i++; continue;
    }
    if (char === "'" || char === '"' || (char === "`" && language === "JavaScript")) {
      quote = char; quoteLine = line; continue;
    }
    if ("([{".includes(char)) stack.push({ bracket: char, line });
    if (")]}".includes(char)) {
      const open = stack.pop();
      if (!open || open.bracket !== expected[char]) {
        findings.push(`Line ${line}: closing ${char} may not match its opening bracket.`);
      }
    }
  }
  if (stack.length) findings.push(`Unclosed bracket(s) near line ${stack[stack.length - 1].line}.`);
  if (quote) findings.push(`A string may be missing its closing quote (started on line ${quoteLine}).`);
  if (/\bconsole\.log\s*\(/u.test(code) && language !== "Python") findings.push("Review console.log calls before submitting.");
  if (language !== "Python" && /==(?!=)/u.test(code)) findings.push("Loose equality (==) found. Confirm type coercion is intentional.");
  if (/TODO|FIXME/u.test(code)) findings.push("TODO/FIXME marker found.");

  return [...new Set(findings.length ? findings : ["No obvious pattern-based issue found. This is not a compiler or code execution."])];
}
