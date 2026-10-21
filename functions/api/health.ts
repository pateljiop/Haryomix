interface Env {
  DB?: { prepare(sql: string): { first<T = unknown>(): Promise<T | null> } };
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  FELO_API_KEY?: string;
  AGENT_ROUTER_API_KEY?: string;
  AGENT_ROUTER_MODEL?: string;
  WHATSTOKEN_API_KEY?: string;
  WHATSTOKEN_MODEL?: string;
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

  // Report only whether secrets/configuration exist. Never return secret values.
  const aiProviders = {
    groq: Boolean(env.GROQ_API_KEY),
    gemini: Boolean(env.GEMINI_API_KEY),
    felo: Boolean(env.FELO_API_KEY),
    agentrouter: Boolean(env.AGENT_ROUTER_API_KEY && env.AGENT_ROUTER_MODEL),
    whatstoken: Boolean(env.WHATSTOKEN_API_KEY && env.WHATSTOKEN_MODEL),
  };
  const anyChatProviderConfigured = Object.values(aiProviders).some(Boolean);
  const databaseReady = databaseConfigured && databaseReachable && rateLimitTableReady;
  const status = databaseReady && anyChatProviderConfigured ? "ok" : "needs-setup";

  return Response.json({
    service: "haryomix-api",
    status,
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
