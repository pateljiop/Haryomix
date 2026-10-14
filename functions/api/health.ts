interface Env {
  DB?: { prepare(sql: string): { first<T = unknown>(): Promise<T | null> } };
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  FELO_API_KEY?: string;
}

export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  const databaseConfigured = Boolean(env.DB);
  let databaseReachable = false;
  let rateLimitTableReady = false;

  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      databaseReachable = true;
      try {
        await env.DB.prepare("SELECT 1 FROM community_rate_limits LIMIT 1").first();
        rateLimitTableReady = true;
      } catch {
        rateLimitTableReady = false;
      }
    } catch {
      databaseReachable = false;
    }
  }

  // Report only whether secrets exist. Never return secret values or provider error bodies.
  const aiProviders = {
    groq: Boolean(env.GROQ_API_KEY),
    gemini: Boolean(env.GEMINI_API_KEY),
    felo: Boolean(env.FELO_API_KEY),
  };
  const anyChatProviderConfigured = aiProviders.groq || aiProviders.gemini || aiProviders.felo;
  const databaseReady = databaseConfigured && databaseReachable && rateLimitTableReady;
  const status = databaseReady && anyChatProviderConfigured ? "ok" : "needs-setup";

  return Response.json({
    service: "haryomix-api",
    status,
    // Keep the original string field for existing health consumers.
    database: databaseConfigured ? (databaseReachable ? "connected" : "unavailable") : "not-configured",
    databaseChecks: {
      configured: databaseConfigured,
      reachable: databaseReachable,
      rateLimitTableReady,
    },
    aiProviders,
    ppt: {
      provider: "felo",
      configured: aiProviders.felo,
    },
    checks: {
      chatReady: databaseReady && anyChatProviderConfigured,
      pptReady: databaseReady && aiProviders.felo,
    },
    timestamp: new Date().toISOString(),
  }, {
    status: status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
