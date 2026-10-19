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
  const [editing, setEditing] = useState<Chore | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [updateError, setUpdateError] = useState<{ id: string; message: string } | null>(null);
  const [fields, setFields] = useState<ReturnType<typeof validateChore>>({});
  const [success, setSuccess] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const deletingRef = useRef(false);
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

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function openSheet(chore: Chore | null, trigger: HTMLElement) {
    if (savingRef.current || updatingRef.current || deletingRef.current) return;
    returnFocus.current = trigger;
    setEditing(chore);
    setSheetVersion((version) => version + 1);
    setConfirmDelete(false);
    setDeleteError("");
    setFields({});
    setSaveError("");
    setSuccess("");
    dialog.current?.showModal();
  }

  async function saveChore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || updatingRef.current || deletingRef.current) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const assigneeId = String(data.get("assigneeId") ?? "");
    const dueDate = String(data.get("dueDate") ?? "");
    const errors = validateChore(title, dueDate, assigneeId, members);
    setFields(errors);
    setSaveError("");
    if (Object.keys(errors).length) {
      const firstField = errors.title ? "title" : errors.dueDate ? "dueDate" : "assigneeId";
      form.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const values = {
        title,
        description: description || null,
        assignee_id: assigneeId || null,
        due_date: dueDate,
      };
      const query = createClient().from("chores");
      const { data: chore, error } = editing
        ? await query.update(values).eq("room_id", roomId).eq("id", editing.id).select(choreColumns).single()
        : await query.insert({ ...values, room_id: roomId, created_by: userId }).select(choreColumns).single();
      if (error) throw new Error(error.message);
      setChores((current) => editing
        ? current.map((item) => item.id === editing.id ? chore as Chore : item)
        : [...current, chore as Chore]);
      dialog.current?.close();
      setSuccess(editing ? "Chore updated" : "Chore added");
    } catch (error) {
      setSaveError(`Could not ${editing ? "save changes" : "add the chore"}: ${error instanceof Error ? error.message : "Request failed."} Try ${editing ? "Save changes" : "Add chore"} again.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus(chore: Chore) {
    if (updatingRef.current || savingRef.current || deletingRef.current) return;
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

  async function deleteChore() {
    if (!editing || deletingRef.current || savingRef.current || updatingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      const { error } = await createClient().from("chores").delete()
        .eq("room_id", roomId).eq("id", editing.id).select("id").single();
      if (error) throw new Error(error.message);
      setChores((current) => current.filter((chore) => chore.id !== editing.id));
      setUpdateError((current) => current?.id === editing.id ? null : current);
      returnFocus.current = addButton.current;
      dialog.current?.close();
      setSuccess("Chore deleted");
    } catch (error) {
      setDeleteError(`Could not delete the chore: ${error instanceof Error ? error.message : "Request failed."} Try Delete chore again.`);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  const doneCount = chores.filter((chore) => chore.status === "done").length;
  const visibleChores = sortChores(chores.filter((chore) =>
    (statusFilter === "all" || chore.status === statusFilter) &&
    (memberFilter === null || chore.assignee_id === memberFilter),
  ));

  function clearFilters() {
    setStatusFilter("all");
    setMemberFilter(null);
  }

  return (
    <section className="board" aria-label="Room chores">
      <div className="board-progress">
        <label htmlFor="room-progress">{doneCount} of {chores.length} done</label>
        <progress id="room-progress" value={doneCount} max={chores.length || 1} />
      </div>
      <div className="board-heading">
        <h2>Chores</h2>
        <button ref={addButton} onClick={(event) => openSheet(null, event.currentTarget)}>Add chore</button>
      </div>
      <p role="status" className="success">{success}</p>
      <div className="filter-chips" role="group" aria-label="Filter chores">
        {(["all", "pending", "done"] as const).map((status) => (
          <button key={status} className="secondary" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
            {status === "all" ? "All" : status === "pending" ? "Pending" : "Done"}
          </button>
        ))}
        {members.map((member) => (
          <button key={member.id} className="secondary" aria-pressed={memberFilter === member.id} onClick={() => setMemberFilter(memberFilter === member.id ? null : member.id)}>
            {member.display_name}
          </button>
        ))}
      </div>
      {updateError && <div role="alert">
        <p className="error">{updateError.message}</p>
        <button className="secondary" disabled={!!updating || saving || deleting} onClick={() => {
          const chore = chores.find((item) => item.id === updateError.id);
          if (chore) void changeStatus(chore);
        }}>Try again</button>
      </div>}
      {chores.length === 0 ? <div className="empty-state">
        <p>No chores yet. Add the first one.</p>
        <button onClick={(event) => openSheet(null, event.currentTarget)}>Add chore</button>
      </div> : visibleChores.length === 0 && <div className="empty-state">
        <p>Nothing matches this filter</p>
        <button className="secondary" onClick={clearFilters}>Clear filter</button>
      </div>}
      <ul className="chore-list">
        {visibleChores.map((chore) => {
          const assignee = members.find((member) => member.id === chore.assignee_id);
          const completedBy = members.find((member) => member.id === chore.completed_by);
          return (
            <li key={chore.id} className="chore-row">
              <div className="chore-details">
                <button className="chore-edit" aria-label={`Edit chore: ${chore.title}`} disabled={!!updating || saving || deleting} onClick={(event) => openSheet(chore, event.currentTarget)}>
                <span className={chore.status === "done" ? "chore-done" : ""}>{chore.title}</span>
                {chore.description && <span className="chore-description">{chore.description}</span>}
                <span>{assignee?.display_name ?? "Unassigned"} · Due <time dateTime={chore.due_date}>{today ? dueDateLabel(chore.due_date, today) : chore.due_date}</time></span>
                {today && isOverdue(chore, today) && <span className="overdue">Overdue</span>}
                {chore.status === "done" && <span>Done{completedBy ? ` by ${completedBy.display_name}` : ""}{chore.completed_at && <> · <time dateTime={chore.completed_at}>{today ? new Date(chore.completed_at).toLocaleString("en-US") : chore.completed_at}</time></>}</span>}
                </button>
              </div>
              <button className="secondary" disabled={!!updating || saving || deleting} aria-label={`${chore.status === "done" ? "Reopen" : "Mark done"}: ${chore.title}`} onClick={() => changeStatus(chore)}>
                {updating === chore.id && <span className="spinner" aria-hidden="true" />}
                {chore.status === "done" ? "Reopen" : "Mark done"}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog ref={dialog} className="chore-sheet" aria-labelledby="chore-sheet-heading" onCancel={(event) => { if (savingRef.current || deletingRef.current) event.preventDefault(); }} onClose={() => { if (returnFocus.current?.isConnected && !returnFocus.current.matches(":disabled")) returnFocus.current.focus(); else addButton.current?.focus(); }}>
        <h2 id="chore-sheet-heading">{confirmDelete ? "Delete chore?" : editing ? "Edit chore" : "Add chore"}</h2>
        <form key={sheetVersion} ref={form} onSubmit={saveChore} noValidate aria-busy={saving} hidden={confirmDelete}>
          <label htmlFor="chore-title">Title</label>
          <input id="chore-title" name="title" defaultValue={editing?.title ?? ""} required maxLength={100} autoFocus disabled={saving} aria-invalid={!!fields.title} aria-describedby={fields.title ? "title-error" : undefined} />
          {fields.title && <p id="title-error" className="error" role="alert">{fields.title}</p>}
          <label htmlFor="chore-description">Description (optional)</label>
          <textarea id="chore-description" name="description" defaultValue={editing?.description ?? ""} rows={3} disabled={saving} />
          <label htmlFor="chore-assignee">Assignee (optional)</label>
          <select id="chore-assignee" name="assigneeId" defaultValue={editing?.assignee_id ?? ""} disabled={saving} aria-invalid={!!fields.assigneeId} aria-describedby={fields.assigneeId ? "assignee-error" : undefined}>
            <option value="">Unassigned</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
          {fields.assigneeId && <p id="assignee-error" className="error" role="alert">{fields.assigneeId}</p>}
          <label htmlFor="chore-due">Due date</label>
          <input id="chore-due" name="dueDate" defaultValue={editing?.due_date ?? ""} type="date" min="0001-01-01" max="9999-12-31" required disabled={saving} aria-invalid={!!fields.dueDate} aria-describedby={fields.dueDate ? "due-error" : undefined} />
          {fields.dueDate && <p id="due-error" className="error" role="alert">{fields.dueDate}</p>}
          {saveError && <p className="error" role="alert">{saveError}</p>}
          <button type="submit" disabled={saving}>{saving && <span className="spinner" aria-hidden="true" />}{saving ? (editing ? "Saving changes…" : "Adding chore…") : (editing ? "Save changes" : "Add chore")}</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
          {editing && <button id="delete-chore" type="button" className="danger" disabled={saving} onClick={() => { setDeleteError(""); setConfirmDelete(true); }}>Delete chore</button>}
        </form>
        {confirmDelete && <div aria-busy={deleting}>
          <p>Delete “{editing?.title}”? This cannot be undone.</p>
          {deleteError && <p className="error" role="alert">{deleteError}</p>}
          <div className="delete-actions">
            <button className="secondary" disabled={deleting} ref={(node) => { node?.focus(); }} onClick={() => { setConfirmDelete(false); window.requestAnimationFrame(() => document.getElementById("delete-chore")?.focus()); }}>Keep chore</button>
            <button className="danger" disabled={deleting} onClick={deleteChore}>
              {deleting && <span className="spinner" aria-hidden="true" />}
              {deleting ? "Deleting chore…" : "Delete chore"}
            </button>
          </div>
        </div>}
      </dialog>
    </section>
  );
}
