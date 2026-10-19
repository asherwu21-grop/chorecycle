# ChoreCycle: Spec

## What it is
A shared chore board for college roommates. A person signs up, creates a room or joins one with a join code, and everyone in the room sees one list of chores. Anyone in the room can add a chore, assign it to a roommate, set a due date, mark it done, and filter the list. Most use is on a phone.

## Who can see and change what
- Anyone can sign up. A new user belongs to no room and can see nothing.
- A user can create a room (becomes a member) or join one by entering its join code.
- Members of a room can see that room's members and chores. Nobody outside the room can.
- Any member can add, edit, complete, reopen and delete any chore in their own room. Roommates are trusted with each other's chores.
- These rules are enforced by row level security in the database, not by hiding buttons.

## Screens
1. `/login`: sign up and sign in with email and password. Errors shown inline.
2. `/start`: shown to a signed-in user with no room. Two choices: "Create a room" (room name + your display name) or "Join a room" (join code + your display name).
3. `/`: the board for the user's room. Everything else happens here, in sheets over the board.
   - Header: room name, join code with a copy button, progress bar ("5 of 8 done").
   - Filter chips: All, Pending, Done, then one chip per roommate. Status and roommate filters combine.
   - Chore list, sorted with overdue first, then by due date. Done chores sit at the bottom.
   - "Add chore" button opens a form sheet. Tapping a chore opens the same sheet to edit it, with a Delete button.
   - Sign out in the header menu.

## Features (must have)
1. Add a chore: title (required, max 100 characters), description (optional), assignee (a roommate in the room, optional), due date (required).
2. Mark a chore done and reopen it. Done chores show who finished them and when.
3. Edit and delete a chore. Delete asks for confirmation.
4. Filter by status and by roommate.
5. Overdue chores (pending and due before today) are clearly marked.
6. Progress bar: done chores out of all chores in the room.
7. Loading, empty, success and error states on every screen (see below).
8. Data persists across reloads and is shared live between roommates on refresh.

## Data model
Tables (Postgres on Supabase). Schema lives in `supabase/migrations/001_init.sql`.

**rooms**: id (uuid, pk), name (text, not null), join_code (text, unique, 6 characters, not null), created_by (uuid, references auth.users), created_at.

**members**: id (uuid, pk), room_id (references rooms), user_id (references auth.users), display_name (text, not null), created_at. Unique on (room_id, user_id).

**chores**: id (uuid, pk), room_id (references rooms), title (text, not null, 1 to 100 characters), description (text), assignee_id (references members, on delete set null), due_date (date, not null), status (text, 'pending' or 'done', default 'pending'), completed_by (references members, nullable), completed_at (timestamptz, nullable), created_by (references auth.users), created_at.

## Security rules (read every policy the agent writes)
- Row level security is ON for rooms, members and chores.
- A helper function `is_room_member(room_id)` (security definer, empty search_path) returns true if the current user has a members row for that room. Policies use it.
- rooms: members can SELECT their own rooms. No direct INSERT, UPDATE or DELETE from the client.
- members: members can SELECT members of their own rooms. No direct INSERT or DELETE from the client.
- chores: members can SELECT, INSERT, UPDATE and DELETE chores where `is_room_member(room_id)` is true. INSERT and UPDATE must also check that the new room_id is a room the user belongs to, and that assignee_id (if set) is a member of the same room.
- `create_room(name, display_name)`: security definer function. Creates the room with a random join code and adds the caller as a member. Returns the room.
- `join_room(code, display_name)`: security definer function. Finds the room by code, adds the caller as a member, returns the room. Errors if the code is wrong. This is the only way to look up a room by code, so codes cannot be listed.
- The app uses only the Supabase URL and the publishable key. The service-role (secret) key is never used, never put in browser code, never committed.
- `.env.local` is git-ignored. Environment variables are set in Vercel's settings.

## Design brief
References are in the screenshots the user provided. Take these ideas and make one coherent look:
- From the lime and black rotation card: near-black text and buttons, one lime accent, a heavy italic display type for the room name and section titles, soft off-white background with white cards.
- From the "68% of chores are completed" phone design: a progress bar at the top of the board.
- From the per-person colored columns: each roommate gets one muted color, used only for their initial-in-a-circle avatar and their filter chip. Not for whole cards.
- From the "To-do" phone screen: round check buttons on the right or left of each row, a category-style label line under the title, a small red "OVERDUE" pill.
- From the compact iOS list and the Overview/This week tabs: tight rows, date shown as plain words ("Today", "Tomorrow", "In 3 days", "2 days ago").

Concrete choices:
- Background about #F2F2ED, cards white, text about #111, accent lime about #DDE86B, overdue red about #C62828 on a light red tint. Check text contrast is at least 4.5:1.
- Do not use Inter or Roboto. Use one expressive display font for headings (for example Bricolage Grotesque, loaded with next/font/google) and one plain readable font for body text (for example Instrument Sans). Substitute if a font will not load.
- Single centered column, max width about 640px on laptops. On phones, full width with 16px side padding. Tap targets at least 44px.
- "Add chore" is a floating button at the bottom right that opens a bottom sheet on phones and a centered dialog on laptops.
- Avoid: purple or indigo gradients, glass-effect cards, gradient headers, emoji as icons, a marketing landing page, three-feature-box sections. The login page is just the app name, one plain sentence about what it does, and the form.
- Copy is plain and specific. Buttons say what happens: "Add chore", "Mark done", "Reopen", "Save changes", "Delete chore", "Create room", "Join room". No words like "seamless" or "empower". No invented numbers or testimonials.

## States
- Loading: skeleton rows on the board, disabled buttons with a spinner on submit.
- Empty: new room with no chores shows "No chores yet. Add the first one." with an Add chore button. A filter with no matches shows "Nothing matches this filter" with a Clear filter button.
- Success: a short confirmation after add, edit, delete ("Chore added").
- Error: every failed request shows a message that says what failed and offers a retry. No silent failures.
- Validation: title required, due date required, join code must be 6 characters, display name required. Show messages next to the field.

## Out of scope (do not build)
Recurring chores, notifications or email, points or rewards, photos, AI features, roles or admin rights, leaving or deleting a room, changing display names, multiple rooms per user, realtime subscriptions, dark mode.

## Build steps (one branch and one pull request each)
1. Database: migration file with tables, helper function, RLS policies, `create_room` and `join_room`.
2. Auth and rooms: Supabase client setup, `/login`, `/start`, route protection.
3. Board core: list, add chore, mark done and reopen, overdue marking.
4. Edit, delete, filters, progress bar, empty/loading/error states.
5. Design pass: fonts, colors, spacing, phone check against the design brief.
6. Review: fresh-session review against this spec, two-user permission test, secrets check.

## Done when
- A new person can open the public URL, sign up, create a room, add a chore, and see it after reloading.
- A second account that has not joined the room cannot read or change that room's chores, tested by trying.
- A second account that joins with the code sees the same chores and can complete them.
- `npm run build` and `npm run lint` pass.
- No secret keys in the repo or its history.
