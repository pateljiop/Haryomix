interface Env { DB?: { prepare(sql: string): { first<T = unknown>(): Promise<T | null> } } }

export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  const databaseConfigured = Boolean(env.DB);
  let databaseReachable = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }
  return Response.json({
    service: "haryomix-api",
    status: databaseConfigured && databaseReachable ? "ok" : "needs-setup",
    database: databaseConfigured ? (databaseReachable ? "connected" : "unavailable") : "not-configured",
    timestamp: new Date().toISOString(),
  }, {
    status: databaseConfigured && databaseReachable ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
