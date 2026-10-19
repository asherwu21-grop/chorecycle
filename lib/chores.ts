export type Member = { id: string; user_id: string; display_name: string };

export type Chore = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string;
  status: "pending" | "done";
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
};

export const choreColumns = "id, title, description, assignee_id, due_date, status, completed_by, completed_at, created_at";

// Compare calendar dates, without converting a date-only value to UTC.
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isOverdue(chore: Chore, today: string) {
  return chore.status === "pending" && chore.due_date < today;
}

export function sortChores(chores: Chore[]) {
  return [...chores].sort((a, b) =>
    Number(a.status === "done") - Number(b.status === "done") ||
    a.due_date.localeCompare(b.due_date) ||
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

export function validateChore(title: string, dueDate: string, assigneeId: string, members: Member[]) {
  const errors: { title?: string; dueDate?: string; assigneeId?: string } = {};
  if (!title.trim()) errors.title = "Enter a title.";
  else if (Array.from(title.trim()).length > 100) errors.title = "Use 100 characters or fewer.";
  const date = new Date(`${dueDate}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || date.getFullYear() < 1 || Number.isNaN(date.getTime()) || localDate(date) !== dueDate) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (assigneeId && !members.some((member) => member.id === assigneeId)) {
    errors.assigneeId = "Choose a member of this room or leave unassigned.";
  }
  return errors;
}
