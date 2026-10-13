import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { getFocusStats, parseFocusSessions, type FocusSession } from "../lib/focus-timer";

const STORAGE_KEY = "haryomix.focus-timer.v1";
type FocusMode = "focus" | "short-break" | "long-break";
const durations: Record<FocusMode, number> = { focus: 25, "short-break": 5, "long-break": 15 };
const labels: Record<FocusMode, string> = { focus: "Focus", "short-break": "Short break", "long-break": "Long break" };
const circumference = 2 * Math.PI * 94;

function localDateKey(date: Date): string {
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function readStoredSessions(): FocusSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseFocusSessions(raw) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

export function FocusTimer() {
  const [mode, setMode] = useState<FocusMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(durations.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>(readStoredSessions);
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const handledDeadline = useRef<number | null>(null);
  const today = localDateKey(new Date());
  const stats = useMemo(() => getFocusStats(sessions, today), [sessions, today]);
  const progress = (durations[mode] * 60 - remainingSeconds) / (durations[mode] * 60);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [sessions]);

  useEffect(() => {
    if (!isRunning || deadline === null) return;
    const update = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0 && handledDeadline.current !== deadline) {
        handledDeadline.current = deadline;
        setIsRunning(false);
        setDeadline(null);
        if (mode === "focus") {
          const session: FocusSession = { id: newId(), completedAt: Date.now(), durationMinutes: durations.focus };
          setSessions(current => [session, ...current].slice(0, 1000));
          setNotice("Focus session complete. Take a break before the next one.");
        } else {
          setNotice("Break complete. Ready for another focus session?");
        }
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [isRunning, deadline, mode]);

  function startOrPause() {
    if (isRunning && deadline !== null) {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setIsRunning(false);
      setDeadline(null);
      setNotice("Timer paused.");
      return;
    }
    const secondsToRun = remainingSeconds <= 0 ? durations[mode] * 60 : remainingSeconds;
    setRemainingSeconds(secondsToRun);
    handledDeadline.current = null;
    setDeadline(Date.now() + secondsToRun * 1000);
    setIsRunning(true);
    setNotice("");
  }

  function resetTimer() {
    setIsRunning(false);
    setDeadline(null);
    handledDeadline.current = null;
    setRemainingSeconds(durations[mode] * 60);
    setNotice("Timer reset.");
  }

  function changeMode(next: FocusMode) {
    setIsRunning(false);
    setDeadline(null);
    handledDeadline.current = null;
    setMode(next);
    setRemainingSeconds(durations[next] * 60);
    setNotice("");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-focus-history.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Focus history backup exported.");
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      setNotice("Backup is too large. Choose a file under 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseFocusSessions(String(reader.result ?? ""));
        setSessions(imported);
        setNotice("Imported " + imported.length + " sessions. Your previous history was replaced.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not import this backup.");
      }
    };
    reader.onerror = () => setNotice("Could not read that backup file.");
    reader.readAsText(file);
  }

  return <div className="hmx-focus-timer">
    <div className="hmx-panel">
      <div className="hmx-panel-head">
        <div><h2>Focus Timer</h2><p className="hmx-focus-subtitle">One focused session at a time. Your history stays on this device.</p></div>
        <span className="hmx-planner-local">LOCAL-FIRST</span>
      </div>
      <div className="hmx-panel-body">
        <div className="hmx-note">A simple Pomodoro timer: 25 minutes of focus, then a short or long break. Only fully completed focus sessions count in your history.</div>
        {storageUnavailable && <div className="hmx-note" role="alert">Browser storage is unavailable. Your focus history may not persist after you leave this page.</div>}
        {notice && <div className="hmx-note" role="status" aria-live="polite">{notice}</div>}
        <div className="hmx-focus-stats">
          <div><span>Sessions today</span><strong>{stats.sessionsToday}</strong></div>
          <div><span>Focus today</span><strong>{stats.focusMinutesToday}m</strong></div>
          <div><span>Total focus</span><strong>{Math.floor(stats.totalFocusMinutes / 60)}h {stats.totalFocusMinutes % 60}m</strong></div>
          <div><span>Current streak</span><strong>{stats.streakDays} day{stats.streakDays === 1 ? "" : "s"}</strong></div>
        </div>
        <div className="hmx-focus-layout">
          <section className="hmx-focus-clock" aria-label="Pomodoro timer">
            <div className="hmx-focus-modes" role="group" aria-label="Timer mode">
              {(Object.keys(durations) as FocusMode[]).map(item => <button type="button" key={item} className={mode === item ? "active" : ""} aria-pressed={mode === item} onClick={() => changeMode(item)}>{labels[item]}</button>)}
            </div>
            <div className="hmx-focus-ring">
              <svg viewBox="0 0 220 220" role="img" aria-label={labels[mode] + " timer: " + formatTime(remainingSeconds) + " remaining"}>
                <circle className="hmx-focus-ring-track" cx="110" cy="110" r="94" />
                <circle className="hmx-focus-ring-progress" cx="110" cy="110" r="94" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))} transform="rotate(-90 110 110)" />
              </svg>
              <div className="hmx-focus-time"><strong>{formatTime(remainingSeconds)}</strong><span>{isRunning ? "IN SESSION" : "READY WHEN YOU ARE"}</span></div>
            </div>
            <div className="hmx-focus-controls"><button type="button" className="hmx-btn primary" onClick={startOrPause}>{isRunning ? "Pause" : "Start focus"}</button><button type="button" className="hmx-btn" onClick={resetTimer}>Reset</button></div>
            <p className="hmx-focus-mode-note">{mode === "focus" ? "Silence distractions and work on one task." : mode === "short-break" ? "Stand up, stretch and rest your eyes." : "Take a longer break before the next focus block."}</p>
          </section>
          <section className="hmx-focus-history">
            <div className="hmx-focus-history-head"><div><h3>Recent focus sessions</h3><p>Only completed 25-minute sessions appear here.</p></div><div className="hmx-btn-row"><button type="button" className="hmx-btn" onClick={exportBackup}>Export ↓</button><label className="hmx-btn hmx-focus-import">Import ↥<input type="file" accept="application/json,.json" onChange={importBackup} aria-label="Import focus history backup; replaces current history"/></label></div></div>
            {sessions.length === 0
              ? <div className="hmx-planner-empty"><span>◷</span><strong>Your first session starts here.</strong><p>Complete a focus block to begin building a personal history.</p></div>
              : <ul className="hmx-focus-session-list">{sessions.slice(0, 8).map(session => <li key={session.id}><span className="hmx-focus-session-dot">✓</span><div><strong>Focus session</strong><small>{new Date(session.completedAt).toLocaleString()}</small></div><b>{session.durationMinutes} min</b></li>)}</ul>}
          </section>
        </div>
      </div>
    </div>
  </div>;
}
