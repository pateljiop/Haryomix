import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";

type Report = {
  reportId: number;
  postId: number;
  reason: "spam" | "harassment" | "personal_info" | "other";
  details: string;
  reportedAt: string;
  reportStatus: "pending" | "reviewed" | "dismissed";
  displayName: string;
  message: string;
  postCreatedAt: string;
  postStatus: "published" | "hidden";
};

const reasonLabels: Record<Report["reason"], string> = {
  spam: "Spam or misleading",
  harassment: "Harassment or abuse",
  personal_info: "Personal or sensitive information",
  other: "Other concern",
};

export function ModerationDashboard({ onHome }: { onHome: () => void }) {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [notice, setNotice] = useState("Enter the moderator token configured in Cloudflare Pages.");
  const [busy, setBusy] = useState(false);

  const loadReports = useCallback(async (authToken: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/moderation", { headers: { Authorization: `Bearer ${authToken}`, Accept: "application/json" } });
      const data = await res.json() as { reports?: Report[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load moderation reports.");
      setReports(data.reports ?? []);
      setSavedToken(authToken);
      setToken("");
      setNotice(`Loaded ${data.reports?.length ?? 0} report(s).`);
    } catch (error) {
      setSavedToken("");
      setNotice(error instanceof Error ? error.message : "Moderator sign-in failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Do not persist moderator credentials in localStorage, sessionStorage, or cookies.
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.length < 32) {
      setNotice("The moderator token must be at least 32 characters.");
      return;
    }
    await loadReports(token);
  }

  async function act(action: "hide_post" | "restore_post" | "dismiss_report" | "mark_reviewed", item: Report) {
    if (!savedToken) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/moderation", {
        method: "POST",
        headers: { Authorization: `Bearer ${savedToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, reportId: item.reportId, postId: item.postId }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Moderation action failed.");
      setNotice(data.message || "Moderation action completed.");
      await loadReports(savedToken);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Moderation action failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{ minHeight: "100vh", padding: "clamp(24px, 5vw, 64px) 20px", background: "#f5f5f2", color: "#20251f" }}>
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <button type="button" className="hmx-study-launch" onClick={onHome}>← Back to Haryomix</button>
      <p className="hmx-overline" style={{ marginTop: 28 }}>Restricted access</p>
      <h1 className="hmx-heading">Community moderation.</h1>
      <p className="hmx-copy">Review reported posts, hide content from the public feed, restore posts, and record report outcomes.</p>
      {!savedToken ? <form onSubmit={signIn} style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 24 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Moderator token
          <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} minLength={32} required placeholder="Paste Cloudflare moderator token" style={inputStyle} />
        </label>
        <button className="hmx-tool-launch" type="submit" disabled={busy}>{busy ? "Checking access…" : "Open moderation dashboard"}</button>
        <p style={{ color: "#747b8d", fontSize: 12, lineHeight: 1.6, margin: 0 }}>The token is held in memory only while this page remains open. Do not share it or paste it into a public computer.</p>
      </form> : <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <strong>{reports.filter(r => r.reportStatus === "pending").length} pending report(s)</strong>
          <button type="button" className="hmx-study-launch" disabled={busy} onClick={() => void loadReports(savedToken)}>Refresh reports ↻</button>
        </div>
        {reports.length === 0 && <p>No reports to review.</p>}
        {reports.map(item => <article key={item.reportId} style={{ padding: 20, background: "#fff", border: "1px solid #e2e4de", borderRadius: 14, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>Report #{item.reportId} · Post #{item.postId}</strong>
            <span style={{ fontSize: 12, color: item.reportStatus === "pending" ? "#9b4e16" : "#747b8d" }}>{item.reportStatus}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13 }}><strong>Reason:</strong> {reasonLabels[item.reason] || item.reason}</p>
          {item.details && <p style={{ margin: 0, fontSize: 13, overflowWrap: "anywhere" }}><strong>Reporter details:</strong> {item.details}</p>}
          <div style={{ padding: 14, background: "#f7f7f4", borderRadius: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13 }}><strong>{item.displayName}</strong> · post status: {item.postStatus}</p>
            <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.message}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {item.postStatus === "published"
              ? <button type="button" className="hmx-tool-launch" disabled={busy} onClick={() => void act("hide_post", item)}>Hide post</button>
              : <button type="button" className="hmx-tool-launch" disabled={busy} onClick={() => void act("restore_post", item)}>Restore post</button>}
            {item.reportStatus === "pending" && <>
              <button type="button" className="hmx-study-launch" disabled={busy} onClick={() => void act("mark_reviewed", item)}>Mark reviewed</button>
              <button type="button" className="hmx-study-launch" disabled={busy} onClick={() => void act("dismiss_report", item)}>Dismiss report</button>
            </>}
          </div>
        </article>)}
      </div>}
      <p role="status" aria-live="polite" style={{ marginTop: 18, color: notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("required") ? "#a33a2b" : "#747b8d", fontSize: 13 }}>{notice}</p>
      {savedToken && <button type="button" className="hmx-study-launch" onClick={() => { setSavedToken(""); setReports([]); setNotice("Signed out."); }}>Sign out</button>}
    </div>
  </main>;
}

const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid #d8dbd4", borderRadius: 10,
  background: "#fff", color: "#20251f", padding: "12px 13px", font: "inherit", outlineOffset: 2,
};
