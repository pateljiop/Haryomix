import { useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import {
  getStudyTaskStats,
  parseStudyTasks,
  sortStudyTasks,
  type StudyTask,
  type StudyTaskPriority,
  type StudyTaskStatusFilter,
} from "../lib/study-planner";

const STORAGE_KEY = "haryomix.study-planner.v1";

function readStoredTasks(): StudyTask[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseStudyTasks(raw) : [];
  } catch {
    return [];
  }
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return String(date.getFullYear()) + "-" + month + "-" + day;
}

function formatDueDate(value: string): string {
  if (!value) return "No deadline";
  return new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function taskDueLabel(task: StudyTask, today: string): string {
  if (task.completed) return "Completed";
  if (!task.dueDate) return "No deadline";
  if (task.dueDate < today) return "Overdue · " + formatDueDate(task.dueDate);
  if (task.dueDate === today) return "Due today";
  return "Due " + formatDueDate(task.dueDate);
}

export function StudyPlanner() {
  const [tasks, setTasks] = useState<StudyTask[]>(readStoredTasks);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<StudyTaskPriority>("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [statusFilter, setStatusFilter] = useState<StudyTaskStatusFilter>("open");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const today = localDateKey(new Date());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [tasks]);

  const subjects = useMemo(
    () => [...new Set(tasks.map(task => task.subject.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [tasks],
  );
  const stats = useMemo(() => getStudyTaskStats(tasks, today), [tasks, today]);
  const visibleTasks = useMemo(() => sortStudyTasks(tasks.filter(task => {
    const matchesStatus = statusFilter === "all" || (statusFilter === "open" ? !task.completed : task.completed);
    const matchesSubject = subjectFilter === "all" || task.subject === subjectFilter;
    return matchesStatus && matchesSubject;
  })), [tasks, statusFilter, subjectFilter]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanSubject = subject.trim();
    if (cleanTitle.length < 3) {
      setNotice("Task title must be at least 3 characters.");
      return;
    }
    if (!cleanSubject) {
      setNotice("Add a subject so tasks are easy to organize.");
      return;
    }
    if (tasks.length >= 500) {
      setNotice("This planner supports up to 500 tasks. Export a backup or remove old tasks first.");
      return;
    }
    const id = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    const task: StudyTask = {
      id,
      title: cleanTitle.slice(0, 160),
      subject: cleanSubject.slice(0, 80),
      dueDate,
      priority,
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? Math.max(5, Math.min(600, Math.round(estimatedMinutes / 5) * 5)) : 30,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks(current => [task, ...current]);
    setTitle("");
    setDueDate("");
    setPriority("medium");
    setEstimatedMinutes(30);
    setNotice("Task saved in this browser.");
  }

  function toggleTask(id: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  }

  function deleteTask(id: string) {
    setTasks(current => current.filter(task => task.id !== id));
    setNotice("Task removed.");
  }

  function clearCompleted() {
    const count = tasks.filter(task => task.completed).length;
    if (!count) {
      setNotice("There are no completed tasks to clear.");
      return;
    }
    setTasks(current => current.filter(task => !task.completed));
    setNotice("Removed " + count + " completed task" + (count === 1 ? "" : "s") + ".");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-study-plan.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Study plan backup exported.");
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
        const imported = parseStudyTasks(String(reader.result ?? ""));
        setTasks(imported);
        setNotice("Imported " + imported.length + " tasks. Your previous list was replaced.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not import this backup.");
      }
    };
    reader.onerror = () => setNotice("Could not read that backup file.");
    reader.readAsText(file);
  }

  return <div className="hmx-study-planner">
    <div className="hmx-panel">
      <div className="hmx-panel-head">
        <div><h2>Study Planner</h2><p className="hmx-planner-subtitle">Plan the next step, not the whole semester at once.</p></div>
        <div className="hmx-btn-row"><a className="hmx-btn" href="/workspace/study-library">Open Notes ↗</a><span className="hmx-planner-local">LOCAL-FIRST</span></div>
      </div>
      <div className="hmx-panel-body">
        <div className="hmx-note">Your tasks stay in this browser. No account or AI key is required. Export a backup before clearing browser data or switching devices.</div>
        {storageUnavailable && <div className="hmx-note" role="alert">Browser storage is unavailable. Your current tasks may not persist after you leave this page.</div>}
        {notice && <div className="hmx-note" role="status" aria-live="polite">{notice}</div>}
        <div className="hmx-planner-stats" aria-label="Study plan summary">
          <div className="hmx-planner-stat"><span>Open tasks</span><strong>{stats.open}</strong></div>
          <div className="hmx-planner-stat"><span>Due today</span><strong>{stats.dueToday}</strong></div>
          <div className="hmx-planner-stat"><span>Overdue</span><strong>{stats.overdue}</strong></div>
          <div className="hmx-planner-stat"><span>Focus estimate</span><strong>{Math.floor(stats.estimatedMinutesOpen / 60)}h {stats.estimatedMinutesOpen % 60}m</strong></div>
        </div>
        <form className="hmx-planner-form" onSubmit={addTask}>
          <div className="hmx-planner-form-head"><h3>Add a study task</h3><span>Up to 500 tasks</span></div>
          <div className="hmx-planner-form-grid">
            <div className="hmx-field hmx-planner-title"><label htmlFor="hmx-plan-title">Task</label><input id="hmx-plan-title" className="hmx-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Revise binary trees" required minLength={3}/></div>
            <div className="hmx-field"><label htmlFor="hmx-plan-subject">Subject</label><input id="hmx-plan-subject" className="hmx-input" value={subject} onChange={event => setSubject(event.target.value)} maxLength={80} placeholder="e.g. Data Structures" required/></div>
            <div className="hmx-field"><label htmlFor="hmx-plan-date">Due date (optional)</label><input id="hmx-plan-date" className="hmx-input" type="date" min="2000-01-01" value={dueDate} onChange={event => setDueDate(event.target.value)}/></div>
            <div className="hmx-field"><label htmlFor="hmx-plan-priority">Priority</label><select id="hmx-plan-priority" className="hmx-select" value={priority} onChange={event => setPriority(event.target.value as StudyTaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div className="hmx-field"><label htmlFor="hmx-plan-minutes">Estimated minutes</label><input id="hmx-plan-minutes" className="hmx-input" type="number" min={5} max={600} step={5} value={estimatedMinutes} onChange={event => setEstimatedMinutes(Number(event.target.value))}/></div>
          </div>
          <div className="hmx-btn-row"><button className="hmx-btn primary" type="submit">Add to plan +</button><button className="hmx-btn" type="button" onClick={exportBackup}>Export backup ↓</button><label className="hmx-btn hmx-planner-import">Import backup (replace) ↥<input type="file" accept="application/json,.json" onChange={importBackup} aria-label="Import study plan backup; replaces current list"/></label></div>
        </form>
        <div className="hmx-planner-list-head">
          <div><h3>Your study tasks</h3><p>{stats.completed} of {stats.total} completed</p></div>
          <button className="hmx-btn" type="button" onClick={clearCompleted}>Clear completed</button>
        </div>
        <div className="hmx-planner-filters">
          <div className="hmx-field"><label htmlFor="hmx-plan-status">Show</label><select id="hmx-plan-status" className="hmx-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StudyTaskStatusFilter)}><option value="open">Open tasks</option><option value="all">All tasks</option><option value="completed">Completed</option></select></div>
          <div className="hmx-field"><label htmlFor="hmx-plan-subject-filter">Subject</label><select id="hmx-plan-subject-filter" className="hmx-select" value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)}><option value="all">All subjects</option>{subjects.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>
        {visibleTasks.length === 0
          ? <div className="hmx-planner-empty"><span>✳</span><strong>{tasks.length ? "Nothing in this view yet." : "Your next step starts here."}</strong><p>{tasks.length ? "Change the filters or add a task for this subject." : "Add an exam topic, assignment or revision session. Your list will stay in this browser."}</p></div>
          : <ul className="hmx-planner-task-list">{visibleTasks.map(task => <li className={"hmx-planner-task" + (task.completed ? " is-complete" : "")} key={task.id}>
              <button className="hmx-planner-check" type="button" onClick={() => toggleTask(task.id)} aria-label={task.completed ? "Mark " + task.title + " incomplete" : "Complete " + task.title} aria-pressed={task.completed}>{task.completed ? "✓" : ""}</button>
              <div className="hmx-planner-task-main"><strong>{task.title}</strong><div className="hmx-planner-task-meta"><span>{task.subject}</span><span className={"hmx-planner-priority priority-" + task.priority}>{task.priority} priority</span><span>{task.estimatedMinutes} min</span></div><span className={"hmx-planner-due" + (!task.completed && task.dueDate && task.dueDate < today ? " is-overdue" : "")}>{taskDueLabel(task, today)}</span></div>
              <button className="hmx-planner-delete" type="button" onClick={() => deleteTask(task.id)} aria-label={"Delete " + task.title}>×</button>
            </li>)}</ul>}
      </div>
    </div>
  </div>;
}
