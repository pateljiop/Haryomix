export interface ModeratorEnv {
  DB?: {
    prepare(sql: string): {
      bind(...values: unknown[]): {
        first<T = Record<string, unknown>>(): Promise<T | null>;
        all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
        run(): Promise<unknown>;
      };
    };
  };
  HARYOMIX_MODERATOR_TOKEN?: string;
}

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

export async function authorized(request: Request, env: ModeratorEnv): Promise<boolean> {
  const expected = env.HARYOMIX_MODERATOR_TOKEN;
  const authorization = request.headers.get("Authorization") ?? "";
  if (!expected || expected.length < 32 || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(expectedHash);
  const b = new Uint8Array(suppliedHash);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
