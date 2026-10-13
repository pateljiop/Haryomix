export type StudyTaskPriority = "low" | "medium" | "high";
export type StudyTaskStatusFilter = "all" | "open" | "completed";

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  priority: StudyTaskPriority;
  estimatedMinutes: number;
  completed: boolean;
  createdAt: number;
}

const priorities: StudyTaskPriority[] = ["low", "medium", "high"];

function isValidDateKey(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isStudyTask(value: unknown): value is StudyTask {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" && task.id.length > 0 && task.id.length <= 100
    && typeof task.title === "string" && task.title.trim().length >= 3 && task.title.length <= 160
    && typeof task.subject === "string" && task.subject.trim().length > 0 && task.subject.length <= 80
    && typeof task.dueDate === "string" && isValidDateKey(task.dueDate)
    && priorities.includes(task.priority as StudyTaskPriority)
    && Number.isInteger(task.estimatedMinutes) && Number(task.estimatedMinutes) >= 5 && Number(task.estimatedMinutes) <= 600
    && typeof task.completed === "boolean"
    && typeof task.createdAt === "number" && Number.isFinite(task.createdAt);
}

export function parseStudyTasks(raw: string): StudyTask[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Study backup is not valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("Study backup must contain a task list.");
  if (parsed.length > 500) throw new Error("A study list can contain at most 500 tasks.");
  if (!parsed.every(isStudyTask)) throw new Error("Study backup contains an invalid task.");
  const ids = new Set<string>();
  for (const task of parsed) {
    if (ids.has(task.id)) throw new Error("Study backup contains duplicate task IDs.");
    ids.add(task.id);
  }
  return parsed;
}

export function sortStudyTasks(tasks: readonly StudyTask[]): StudyTask[] {
  const priorityRank: Record<StudyTaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    return priority || a.createdAt - b.createdAt;
  });
}

export function getStudyTaskStats(tasks: readonly StudyTask[], today: string): {
  total: number;
  completed: number;
  open: number;
  dueToday: number;
  overdue: number;
  estimatedMinutesOpen: number;
} {
  const open = tasks.filter(task => !task.completed);
  return {
    total: tasks.length,
    completed: tasks.length - open.length,
    open: open.length,
    dueToday: open.filter(task => task.dueDate === today).length,
    overdue: open.filter(task => task.dueDate !== "" && task.dueDate < today).length,
    estimatedMinutesOpen: open.reduce((sum, task) => sum + task.estimatedMinutes, 0),
  };
}
