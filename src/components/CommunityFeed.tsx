import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";

type Post = { id: number; displayName: string; message: string; createdAt: string };
type ReportReason = "spam" | "harassment" | "personal_info" | "other";

export function CommunityFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("Loading community…");
  const [busy, setBusy] = useState(false);
  const [reportPostId, setReportPostId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/community", { headers: { Accept: "application/json" } });
      const data = await res.json() as { posts?: Post[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Community feed is unavailable.");
      setPosts(data.posts ?? []);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the community feed.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ displayName, message }),
      });
      const data = await res.json() as { post?: Post; error?: string };
      if (!res.ok) throw new Error(data.error || "Your post could not be published.");
      if (data.post) setPosts(current => [data.post!, ...current].slice(0, 50));
      setMessage("");
      setNotice("Your post is published.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your post could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reportPostId === null) return;
    setReportBusy(true);
    setReportNotice("");
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ postId: reportPostId, reason: reportReason, details: reportDetails }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not send report.");
      setReportNotice(data.message || "Report received for review.");
      setReportDetails("");
      setReportPostId(null);
    } catch (error) {
      setReportNotice(error instanceof Error ? error.message : "Could not send report.");
    } finally {
      setReportBusy(false);
    }
  }

  return <section id="community" style={{ padding: "clamp(52px, 8vw, 100px) 24px", background: "#f5f5f2", color: "#20251f" }}>
    <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, .9fr) minmax(0, 1.1fr)", gap: 36 }}>
      <div>
        <p className="hmx-overline">Made better together</p>
        <h2 className="hmx-heading">The student community.</h2>
        <p className="hmx-copy">Share a small win, ask for study ideas or tell other learners what you are building.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Display name
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={40} required placeholder="Your name" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Your post
            <textarea value={message} onChange={e => setMessage(e.target.value)} minLength={3} maxLength={500} required rows={4} placeholder="What are you working on?" style={{ ...inputStyle, resize: "vertical" }} />
          </label>
          <button className="hmx-tool-launch" type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish to community ↗"}</button>
          <p role="status" aria-live="polite" style={{ margin: 0, color: notice.startsWith("Your post is") ? "#246a43" : "#747b8d", fontSize: 12, lineHeight: 1.6 }}>{notice || "Posts are public. Do not share passwords, private documents or personal contact details."}</p>
        </form>
        <p style={{ color: "#747b8d", fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>Posts are public and may appear immediately. Reports are stored privately for review, but review is not yet automated or guaranteed to be immediate.</p>
      </div>
      <div style={{ display: "grid", alignContent: "start", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>Latest posts</h3>
          <button type="button" className="hmx-study-launch" onClick={() => void refresh()}>Refresh ↻</button>
        </div>
        {posts.length === 0 && !notice && <p style={{ color: "#747b8d" }}>No posts yet. Start the conversation.</p>}
        {posts.map(post => <article key={post.id} style={{ padding: 18, background: "#fff", border: "1px solid #e2e4de", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>{post.displayName}</strong>
            <time style={{ color: "#858b80", fontSize: 11 }} dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString()}</time>
          </div>
          <p style={{ margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.message}</p>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="hmx-study-launch" onClick={() => { setReportPostId(reportPostId === post.id ? null : post.id); setReportNotice(""); setReportReason("spam"); setReportDetails(""); }} aria-expanded={reportPostId === post.id}>Report post</button>
          </div>
          {reportPostId === post.id && <form onSubmit={submitReport} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e4de", display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12 }}>Why are you reporting this?
              <select value={reportReason} onChange={e => setReportReason(e.target.value as ReportReason)} style={inputStyle}>
                <option value="spam">Spam or misleading</option>
                <option value="harassment">Harassment or abuse</option>
                <option value="personal_info">Personal or sensitive information</option>
                <option value="other">Other concern</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12 }}>Extra details (optional)
              <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={300} rows={2} placeholder="Add context, without sharing your own private information." style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" className="hmx-tool-launch" disabled={reportBusy}>{reportBusy ? "Sending…" : "Send report"}</button>
              <button type="button" className="hmx-study-launch" onClick={() => setReportPostId(null)} disabled={reportBusy}>Cancel</button>
            </div>
          </form>}
        </article>)}
        <p role="status" aria-live="polite" style={{ color: reportNotice ? "#246a43" : "#747b8d", fontSize: 12, margin: 0 }}>{reportNotice}</p>
      </div>
    </div>
    <style>{`#community .hmx-overline{color:#287ea8!important}#community .hmx-heading{color:#20251f!important;text-shadow:none!important;-webkit-text-fill-color:#20251f!important}#community .hmx-copy{color:#596273!important}@media(max-width:760px){#community>div{grid-template-columns:minmax(0,1fr)!important}}`}</style>
  </section>;
}

const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid #d8dbd4", borderRadius: 10,
  background: "#fff", color: "#20251f", padding: "12px 13px", font: "inherit", outlineOffset: 2,
};
