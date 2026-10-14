import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  deleteStudyResource,
  filterStudyResources,
  parseStudyLibraryBackup,
  readStudyResources,
  replaceStudyResources,
  saveStudyResource,
  type StudyResource,
  type StudyResourceKind,
} from "../lib/study-library";

function newId(): string {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function SmartNotes() {
  const [items, setItems] = useState<StudyResource[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<StudyResourceKind>("note");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | StudyResourceKind>("all");
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState("");

  async function refresh(preferredId?: string) {
    const next = await readStudyResources();
    setItems(next);
    setSelectedId(current => {
      const wanted = preferredId || current;
      return next.some(item => item.id === wanted) ? wanted : (next[0]?.id ?? "");
    });
  }

  useEffect(() => {
    let cancelled = false;
    void readStudyResources().then(next => {
      if (cancelled) return;
      setItems(next);
      setSelectedId(next[0]?.id ?? "");
      setStorageError("");
    }).catch(error => {
      if (cancelled) return;
      setStorageError(error instanceof Error ? error.message : "Could not open browser storage.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleItems = useMemo(() => filterStudyResources(items, query, kindFilter), [items, query, kindFilter]);
  const selected = items.find(item => item.id === selectedId) ?? null;

  function resetForm() {
    setTitle("");
    setKind("note");
    setContent("");
    setTagsInput("");
    setSourceUrl("");
    setEditingId("");
  }

  function startEdit(item: StudyResource) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setTitle(item.title);
    setKind(item.kind);
    setContent(item.content);
    setTagsInput(item.tags.join(", "));
    setSourceUrl(item.sourceUrl);
    setNotice("Editing saved item.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanUrl = sourceUrl.trim();
    const tags = [...new Set(tagsInput.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => tag.slice(0, 32)))].slice(0, 12);
    if (cleanTitle.length < 3) { setNotice("Title must be at least 3 characters."); return; }
    if (kind !== "link" && !cleanContent) { setNotice("Add the note or resource content before saving."); return; }
    if (kind === "link" && (!cleanUrl || !/^https?:\/\//i.test(cleanUrl))) { setNotice("Add a valid http:// or https:// source URL for a link."); return; }
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) { setNotice("Source URL must begin with http:// or https://."); return; }
    if (!editingId && items.length >= 500) { setNotice("Notes limit reached (500 items). Export a backup or delete older items first."); return; }
    const existing = items.find(item => item.id === editingId);
    const now = Date.now();
    const item: StudyResource = {
      id: existing?.id ?? newId(),
      title: cleanTitle.slice(0, 160),
      kind,
      content: cleanContent.slice(0, 100000),
      tags,
      sourceUrl: cleanUrl.slice(0, 2048),
      createdAt: existing?.createdAt ?? now,
      updatedAt: Math.max(now, existing?.createdAt ?? now),
    };
    setBusy(true);
    try {
      await saveStudyResource(item);
      await refresh(item.id);
      resetForm();
      setNotice(existing ? "Note updated in this browser." : "Note saved in this browser.");
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Could not save this study item.");
    } finally { setBusy(false); }
  }

  async function remove(item: StudyResource) {
    if (!window.confirm("Delete “" + item.title + "” from this browser? Export a backup first if you may need it later.")) return;
    setBusy(true);
    try {
      await deleteStudyResource(item.id);
      await refresh();
      if (editingId === item.id) resetForm();
      setNotice("Note deleted.");
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Could not delete this item.");
    } finally { setBusy(false); }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-notes.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Study notes backup exported.");
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 5_000_000) { setNotice("Backup is too large. Choose a file under 5 MB."); return; }
    if (!window.confirm("Importing replaces your current notes. Export a backup first if you want to keep it. Continue?")) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        setBusy(true);
        try {
          const imported = parseStudyLibraryBackup(String(reader.result ?? ""));
          await replaceStudyResources(imported);
          await refresh(imported[0]?.id);
          resetForm();
          setNotice("Imported " + imported.length + " notes. Your previous notes were replaced.");
          setStorageError("");
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Could not import this backup.");
        } finally { setBusy(false); }
      })();
    };
    reader.onerror = () => setNotice("Could not read that backup file.");
    reader.readAsText(file);
  }

  function exportMarkdown(item: StudyResource) {
    const content = [
      "# " + item.title,
      "",
      "> Type: " + item.kind,
      "> Tags: " + (item.tags.join(", ") || "none"),
      "",
      item.content,
      "",
      item.sourceUrl ? "Source: " + item.sourceUrl : "",
      "",
      "_Exported from Haryomix Smart Notes._",
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + ".md";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Downloaded “" + item.title + "” as Markdown. No AI call was made.");
  }

  async function copySelectedContent(item: StudyResource) {
    try {
      await navigator.clipboard.writeText(item.content || item.sourceUrl || item.title);
      setNotice("Copied “" + item.title + "” to clipboard.");
    } catch {
      setNotice("Clipboard access was blocked by the browser. Use Download Markdown instead.");
    }
  }

  async function clearLibrary() {
    if (!items.length) { setNotice("Your notes are already empty."); return; }
    if (!window.confirm("Delete all " + items.length + " study items from this browser? This cannot be undone. Export a backup first if needed.")) return;
    setBusy(true);
    try {
      await replaceStudyResources([]);
      setItems([]);
      setSelectedId("");
      resetForm();
      setNotice("Notes cleared.");
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Could not clear the notes.");
    } finally { setBusy(false); }
  }

  return <div className="hmx-study-library">
    <div className="hmx-panel">
      <div className="hmx-panel-head">
        <div><h2>Smart Notes</h2><p className="hmx-library-subtitle">Keep class notes, revision summaries and trusted resources together.</p></div>
        <span className="hmx-planner-local">ON THIS DEVICE</span>
      </div>
      <div className="hmx-panel-body">
        <div className="hmx-note">Your notes use this browser's IndexedDB storage. It is not uploaded or synced to an account. Export JSON regularly before clearing site data or switching devices.</div>
        {storageError && <div className="hmx-note" role="alert">{storageError}</div>}
        {notice && <div className="hmx-note" role="status" aria-live="polite">{notice}</div>}
        <div className="hmx-library-toolbar">
          <div className="hmx-library-count"><strong>{items.length}</strong><span> / 500 saved items</span></div>
          <div className="hmx-btn-row">
            <button type="button" className="hmx-btn" onClick={exportBackup} disabled={loading || !items.length}>Export backup ↓</button>
            <label className="hmx-btn hmx-library-import">Import backup ↥<input type="file" accept="application/json,.json" aria-label="Import notes backup; replaces current notes" onChange={importBackup} disabled={busy}/></label>
            <button type="button" className="hmx-btn" onClick={() => void clearLibrary()} disabled={busy || !items.length}>Clear notes</button>
          </div>
        </div>
        {loading
          ? <div className="hmx-planner-empty"><strong>Opening your notes…</strong></div>
          : <div className="hmx-library-layout">
            <section className="hmx-library-editor">
              <h3>{editingId ? "Edit study item" : "Add to your notes workspace"}</h3>
              {!editingId && <div className="hmx-field"><label>Start with a ready-made note template (no AI)</label><div className="hmx-btn-row">{[
                {label:"Lecture notes",title:"Lecture Notes — ",tags:"lecture, class",content:"## Topic / lecture date\n\n## Learning objectives\n- \n\n## Key concepts\n- \n\n## Definitions\n- \n\n## Examples / diagrams\n- \n\n## Questions to ask\n- \n\n## Quick recap\n- "},
                {label:"Exam revision",title:"Exam Revision — ",tags:"revision, exam",content:"## Syllabus topic\n\n## Must-know definitions\n- \n\n## Important points\n1. \n2. \n3. \n\n## Formulas / dates / facts\n- \n\n## Common mistakes\n- \n\n## 5-minute self-test\n1. \n2. \n3. \n\n## Still unclear\n- "},
                {label:"Formula sheet",title:"Formula Sheet — ",tags:"formula, revision",content:"## Topic\n\n| Formula | Meaning of symbols | When to use |\n|---|---|---|\n|  |  |  |\n\n## Units / conditions\n- \n\n## Worked example\nGiven:\n\nSteps:\n\nAnswer:\n\n## Common mistakes\n- "},
                {label:"Practical / lab",title:"Practical Notes — ",tags:"practical, lab",content:"## Experiment / practical title\n\n## Aim\n\n## Requirements\n- \n\n## Theory\n\n## Procedure\n1. \n2. \n3. \n\n## Observation / output\n\n## Result\n\n## Viva questions\n1. \n2. \n3. "},
                {label:"Chapter summary",title:"Chapter Summary — ",tags:"chapter, summary",content:"## Chapter / topic\n\n## Main idea in 3 lines\n\n## Key terms\n- \n\n## Important details\n- \n\n## Example in my own words\n\n## Connections to other topics\n- \n\n## Questions for later revision\n- "}
              ].map(template => <button key={template.label} type="button" className="hmx-btn" onClick={() => { setKind("note"); setTitle(template.title); setContent(template.content); setTagsInput(template.tags); setSourceUrl(""); setNotice(template.label + " template loaded. Fill the blanks and save it—no AI call is made."); }}>{template.label} +</button>)}</div></div>}
              <form className="hmx-library-form" onSubmit={submit}>
                <div className="hmx-field"><label htmlFor="hmx-library-title">Title</label><input id="hmx-library-title" className="hmx-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required minLength={3} placeholder="e.g. OS Unit 2 — process scheduling"/></div>
                <div className="hmx-field"><label htmlFor="hmx-library-kind">Item type</label><select id="hmx-library-kind" className="hmx-select" value={kind} onChange={event => setKind(event.target.value as StudyResourceKind)}><option value="note">Class note</option><option value="resource">Revision resource</option><option value="link">Web link</option></select></div>
                <div className="hmx-field"><label htmlFor="hmx-library-content">{kind === "note" ? "Notes" : kind === "resource" ? "Resource summary / key points" : "Description (optional)"}</label><textarea id="hmx-library-content" className="hmx-textarea" value={content} onChange={event => setContent(event.target.value)} maxLength={100000} required={kind !== "link"} rows={7} placeholder={kind === "note" ? "Write your own notes or paste a concise summary…" : kind === "resource" ? "Capture the key points you want to revise…" : "What is this link useful for?"}/></div>
                <div className="hmx-field"><label htmlFor="hmx-library-tags">Tags (comma separated)</label><input id="hmx-library-tags" className="hmx-input" value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder="e.g. BCA, DBMS, exam"/></div>
                <div className="hmx-field"><label htmlFor="hmx-library-url">Source URL {kind === "link" ? "(required)" : "(optional)"}</label><input id="hmx-library-url" className="hmx-input" type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2048} required={kind === "link"} placeholder="https://example.com/resource"/></div>
                <div className="hmx-btn-row"><button type="submit" className="hmx-btn primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save note +"}</button>{editingId && <button type="button" className="hmx-btn" onClick={resetForm} disabled={busy}>Cancel edit</button>}</div>
              </form>
            </section>
            <section className="hmx-library-browser">
              <div className="hmx-library-browser-head"><h3>Your saved items</h3><span>{visibleItems.length} shown</span></div>
              <div className="hmx-field"><label htmlFor="hmx-library-search">Search notes and resources</label><input id="hmx-library-search" className="hmx-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, notes, tags or URLs…"/></div>
              <div className="hmx-field"><label htmlFor="hmx-library-filter">Filter by type</label><select id="hmx-library-filter" className="hmx-select" value={kindFilter} onChange={event => setKindFilter(event.target.value as "all" | StudyResourceKind)}><option value="all">All items</option><option value="note">Class notes</option><option value="resource">Revision resources</option><option value="link">Web links</option></select></div>
              {visibleItems.length === 0
                ? <div className="hmx-planner-empty"><span>▤</span><strong>{items.length ? "No matching items." : "Your notes is empty."}</strong><p>{items.length ? "Try a different search or type filter." : "Save notes, summaries and useful links here. Export a backup before switching devices."}</p></div>
                : <ul className="hmx-library-list">{visibleItems.map(item => <li key={item.id} className={"hmx-library-item" + (item.id === selectedId ? " selected" : "")}>
                  <button type="button" className="hmx-library-item-open" onClick={() => setSelectedId(item.id)}><span className="hmx-library-kind">{item.kind === "note" ? "NOTE" : item.kind === "resource" ? "RESOURCE" : "LINK"}</span><strong>{item.title}</strong><small>Updated {formatDate(item.updatedAt)}</small><span className="hmx-library-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</span></button>
                  <div className="hmx-library-item-actions"><button type="button" className="hmx-btn" onClick={() => startEdit(item)} disabled={busy}>Edit</button><button type="button" className="hmx-planner-delete" onClick={() => void remove(item)} disabled={busy} aria-label={"Delete " + item.title}>×</button></div>
                </li>)}</ul>}
              {selected && <article className="hmx-library-detail"><div className="hmx-library-detail-head"><div><span className="hmx-library-kind">{selected.kind.toUpperCase()}</span><h3>{selected.title}</h3></div><div className="hmx-btn-row"><button type="button" className="hmx-btn" onClick={() => exportMarkdown(selected)}>Download .md ↓</button><button type="button" className="hmx-btn" onClick={() => void copySelectedContent(selected)}>Copy</button><button type="button" className="hmx-btn" onClick={() => startEdit(selected)} disabled={busy}>Edit item</button></div></div>
                {selected.content && <p className="hmx-library-detail-content">{selected.content}</p>}
                {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer noopener" className="hmx-library-source">Open source ↗</a>}
                <div className="hmx-library-detail-foot"><span>Created {formatDate(selected.createdAt)}</span><span>Updated {formatDate(selected.updatedAt)}</span></div>
              </article>}
            </section>
          </div>}
      </div>
    </div>
  </div>;
}
