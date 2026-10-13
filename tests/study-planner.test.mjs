import test from "node:test";
import assert from "node:assert/strict";
import {
  getStudyTaskStats,
  isStudyTask,
  parseStudyTasks,
  sortStudyTasks,
} from "../src/lib/study-planner.ts";

function task(overrides = {}) {
  return {
    id: "task-1",
    title: "Revise data structures",
    subject: "Computer Science",
    dueDate: "2026-10-14",
    priority: "medium",
    estimatedMinutes: 30,
    completed: false,
    createdAt: 100,
    ...overrides,
  };
}

test("study task validator accepts a well-formed local task", () => {
  assert.equal(isStudyTask(task()), true);
});

test("study backup parser validates JSON arrays and task records", () => {
  assert.deepEqual(parseStudyTasks(JSON.stringify([task()])), [task()]);
  assert.throws(() => parseStudyTasks("{"), /not valid JSON/);
  assert.throws(() => parseStudyTasks(JSON.stringify({ task: task() })), /task list/);
  assert.throws(() => parseStudyTasks(JSON.stringify([{ ...task(), estimatedMinutes: 0 }])), /invalid task/);
});

test("study backup parser rejects duplicate IDs and oversized lists", () => {
  assert.throws(() => parseStudyTasks(JSON.stringify([task(), task()])), /duplicate task IDs/);
  const many = Array.from({ length: 501 }, (_, i) => task({ id: "task-" + i }));
  assert.throws(() => parseStudyTasks(JSON.stringify(many)), /at most 500 tasks/);
});

test("study task sorting prioritizes open work, earlier deadlines, then priority", () => {
  const sorted = sortStudyTasks([
    task({ id: "completed", completed: true, dueDate: "2026-10-10", priority: "high" }),
    task({ id: "no-date", dueDate: "", priority: "high" }),
    task({ id: "low", dueDate: "2026-10-15", priority: "low" }),
    task({ id: "high", dueDate: "2026-10-15", priority: "high" }),
    task({ id: "earlier", dueDate: "2026-10-13", priority: "low" }),
  ]);
  assert.deepEqual(sorted.map(item => item.id), ["earlier", "high", "low", "no-date", "completed"]);
});

test("study task stats report open, completed, due-today, overdue and remaining minutes", () => {
  const tasks = [
    task({ id: "today", dueDate: "2026-10-14", estimatedMinutes: 30 }),
    task({ id: "overdue", dueDate: "2026-10-13", estimatedMinutes: 45 }),
    task({ id: "future", dueDate: "2026-10-20", estimatedMinutes: 60 }),
    task({ id: "done", completed: true, dueDate: "2026-10-10", estimatedMinutes: 90 }),
    task({ id: "undated", dueDate: "", estimatedMinutes: 15 }),
  ];
  assert.deepEqual(getStudyTaskStats(tasks, "2026-10-14"), {
    total: 5,
    completed: 1,
    open: 4,
    dueToday: 1,
    overdue: 1,
    estimatedMinutesOpen: 150,
  });
});
