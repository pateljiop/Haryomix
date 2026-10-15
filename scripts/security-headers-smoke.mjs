#!/usr/bin/env node
const base = (process.argv[2] || "https://haryomix.pages.dev").replace(/\/$/, "");

const response = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(15000) });
if (!response.ok) {
  throw new Error(`Homepage returned HTTP ${response.status}; security headers cannot be verified.`);
}

const checks = [
  ["strict-transport-security", value => /(?:^|;\s*)max-age=31536000(?:;|$)/i.test(value), "HSTS max-age=31536000"],
  ["x-content-type-options", value => value.toLowerCase() === "nosniff", "X-Content-Type-Options: nosniff"],
  ["x-frame-options", value => value.toUpperCase() === "DENY", "X-Frame-Options: DENY"],
  ["referrer-policy", value => value.toLowerCase() === "strict-origin-when-cross-origin", "strict Referrer-Policy"],
  ["permissions-policy", value => /camera=\(\)/.test(value) && /microphone=\(\)/.test(value) && /geolocation=\(\)/.test(value), "camera/microphone/geolocation disabled"],
  ["content-security-policy", value => /base-uri\s+'self'/i.test(value) && /object-src\s+'none'/i.test(value) && /frame-ancestors\s+'none'/i.test(value) && /form-action\s+'self'/i.test(value), "CSP base-uri/object-src/frame-ancestors/form-action directives"],
  ["x-permitted-cross-domain-policies", value => value.toLowerCase() === "none", "legacy cross-domain policy disabled"],
];

const missing = [];
for (const [name, verify, label] of checks) {
  const value = response.headers.get(name);
  if (!value || !verify(value)) missing.push(`${name}: ${value ?? "missing"}`);
  else console.log(`PASS: ${label}`);
}
if (missing.length) {
  console.error("FAIL: production security headers are missing or incorrect:");
  for (const item of missing) console.error(` - ${item}`);
  process.exitCode = 1;
} else {
  console.log(`All production security header checks passed for ${base}`);
}
