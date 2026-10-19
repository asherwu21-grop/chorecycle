"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { choreColumns, isOverdue, localDate, sortChores, validateChore, type Chore, type Member } from "@/lib/chores";

function dueDateLabel(dueDate: string, today: string) {
  // Use the browser's calendar date, with fixed-length days for DST-safe differences.
  const days = Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return `${-days} ${days === -1 ? "day" : "days"} ago`;
}

export function Board({ roomId, userId, members, initialChores }: {
  roomId: string;
  userId: string;
  members: Member[];
  initialChores: Chore[];
}) {
  const [chores, setChores] = useState(initialChores);
  const [today, setToday] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [updateError, setUpdateError] = useState<{ id: string; message: string } | null>(null);
  const [fields, setFields] = useState<ReturnType<typeof validateChore>>({});
  const [success, setSuccess] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const updatingRef = useRef(false);

  useEffect(() => {
    const update = () => setToday(localDate());
    update();
    const interval = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, []);

  function openAdd() {
    setFields({});
    setAddError("");
    setSuccess("");
    form.current?.reset();
    dialog.current?.showModal();
  }

  async function addChore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const assigneeId = String(data.get("assigneeId") ?? "");
    const dueDate = String(data.get("dueDate") ?? "");
    const errors = validateChore(title, dueDate, assigneeId, members);
    setFields(errors);
    setAddError("");
    if (Object.keys(errors).length) {
      const firstField = errors.title ? "title" : errors.dueDate ? "dueDate" : "assigneeId";
      form.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data: chore, error } = await createClient().from("chores").insert({
        room_id: roomId,
        title,
        description: description || null,
        assignee_id: assigneeId || null,
        due_date: dueDate,
        created_by: userId,
      }).select(choreColumns).single();
      if (error) throw new Error(error.message);
      setChores((current) => [...current, chore as Chore]);
      dialog.current?.close();
      setSuccess("Chore added");
    } catch (error) {
      setAddError(`Could not add the chore: ${error instanceof Error ? error.message : "Request failed."} Try Add chore again.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus(chore: Chore) {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(chore.id);
    setUpdateError(null);
    setSuccess("");
    const done = chore.status === "pending";
    try {
      const member = members.find((member) => member.user_id === userId);
      if (!member) throw new Error("Your room membership could not be found. Reload and try again.");
      const { data, error } = await createClient().from("chores").update({
        status: done ? "done" : "pending",
        completed_by: done ? member.id : null,
        completed_at: done ? new Date().toISOString() : null,
      }).eq("room_id", roomId).eq("id", chore.id).select(choreColumns).single();
      if (error) throw new Error(error.message);
      setChores((current) => current.map((item) => item.id === chore.id ? data as Chore : item));
      setSuccess(done ? "Chore marked done" : "Chore reopened");
    } catch (error) {
      setUpdateError({ id: chore.id, message: `Could not ${done ? "mark the chore done" : "reopen the chore"}: ${error instanceof Error ? error.message : "Request failed."}` });
    } finally {
      updatingRef.current = false;
      setUpdating(null);
    }
  }

  return (
    <section className="board" aria-label="Room chores">
      <div className="board-heading">
        <h2>Chores</h2>
        <button ref={addButton} onClick={openAdd}>Add chore</button>
      </div>
      <p role="status" className="success">{success}</p>
      {chores.length === 0 && <p>No chores yet. Add the first one.</p>}
      <ul className="chore-list">
        {sortChores(chores).map((chore) => {
          const assignee = members.find((member) => member.id === chore.assignee_id);
          const completedBy = members.find((member) => member.id === chore.completed_by);
          return (
            <li key={chore.id} className="chore-row">
              <div className="chore-details">
                <h3 className={chore.status === "done" ? "chore-done" : ""}>{chore.title}</h3>
                {chore.description && <p className="chore-description">{chore.description}</p>}
                <p>{assignee?.display_name ?? "Unassigned"} · Due <time dateTime={chore.due_date}>{today ? dueDateLabel(chore.due_date, today) : chore.due_date}</time></p>
                {today && isOverdue(chore, today) && <span className="overdue">Overdue</span>}
                {chore.status === "done" && <p>Done{completedBy ? ` by ${completedBy.display_name}` : ""}{chore.completed_at && <> · <time dateTime={chore.completed_at}>{today ? new Date(chore.completed_at).toLocaleString("en-US") : chore.completed_at}</time></>}</p>}
                {updateError?.id === chore.id && <div role="alert">
                  <p className="error">{updateError.message}</p>
                  <button className="secondary" disabled={!!updating} onClick={() => changeStatus(chore)}>Try again</button>
                </div>}
              </div>
              <button className="secondary" disabled={!!updating} aria-label={`${chore.status === "done" ? "Reopen" : "Mark done"}: ${chore.title}`} onClick={() => changeStatus(chore)}>
                {updating === chore.id && <span className="spinner" aria-hidden="true" />}
                {chore.status === "done" ? "Reopen" : "Mark done"}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog ref={dialog} className="chore-sheet" aria-labelledby="add-chore-heading" onCancel={(event) => { if (savingRef.current) event.preventDefault(); }} onClose={() => addButton.current?.focus()}>
        <h2 id="add-chore-heading">Add chore</h2>
        <form ref={form} onSubmit={addChore} noValidate aria-busy={saving}>
          <label htmlFor="chore-title">Title</label>
          <input id="chore-title" name="title" required maxLength={100} autoFocus disabled={saving} aria-invalid={!!fields.title} aria-describedby={fields.title ? "title-error" : undefined} />
          {fields.title && <p id="title-error" className="error" role="alert">{fields.title}</p>}
          <label htmlFor="chore-description">Description (optional)</label>
          <textarea id="chore-description" name="description" rows={3} disabled={saving} />
          <label htmlFor="chore-assignee">Assignee (optional)</label>
          <select id="chore-assignee" name="assigneeId" disabled={saving} aria-invalid={!!fields.assigneeId} aria-describedby={fields.assigneeId ? "assignee-error" : undefined}>
            <option value="">Unassigned</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
          {fields.assigneeId && <p id="assignee-error" className="error" role="alert">{fields.assigneeId}</p>}
          <label htmlFor="chore-due">Due date</label>
          <input id="chore-due" name="dueDate" type="date" min="0001-01-01" max="9999-12-31" required disabled={saving} aria-invalid={!!fields.dueDate} aria-describedby={fields.dueDate ? "due-error" : undefined} />
          {fields.dueDate && <p id="due-error" className="error" role="alert">{fields.dueDate}</p>}
          {addError && <p className="error" role="alert">{addError}</p>}
          <button type="submit" disabled={saving}>{saving && <span className="spinner" aria-hidden="true" />}{saving ? "Adding chore…" : "Add chore"}</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
        </form>
      </dialog>
    </section>
  );
}
