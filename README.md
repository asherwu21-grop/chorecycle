# ChoreCycle

A shared chore board for college roommates. Create a room, share the join code, and everyone in the room sees one list of chores: add a chore, assign it to a roommate, set a due date, mark it done, and filter by status or person. Overdue chores are marked clearly.

**Live app:** https://chorecycle-gamma.vercel.app

Built for the Technify SWE training, mostly with a coding agent (Codex), working from a written spec ([SPEC.md](SPEC.md)) and agent rules ([AGENTS.md](AGENTS.md)).

## How to use it
1. Sign up with an email and password.
2. Create a room (room name and your display name), or join one with a six-character code from a roommate.
3. Add chores, tick them off, reopen them, filter the list. The join code is in the board header with a copy button, so you can invite others.

## How it works
Three parts:

| Part | What it does |
|---|---|
| Frontend | Next.js (App Router) and TypeScript with Tailwind CSS, hosted on Vercel. Server pages check the signed-in user and send people to `/login`, `/start` (create or join a room) or `/` (the board). |
| Backend | Supabase Auth for sign-up and sign-in. Two database functions, `create_room` and `join_room`, handle entering a room. A small proxy in Next.js refreshes session cookies. |
| Database | Supabase Postgres with three tables: `rooms`, `members` and `chores`. |

Adding a chore, step by step: the browser sends an insert to Supabase with the user's login token, Postgres checks the row level security policy (is this user a member of the chore's room, and is the assignee a member of the same room?), the row is saved, and the board reloads the list.

## Security model
- **Who can see what:** only members of a room can see its members and chores. Any member can add, edit, complete, reopen and delete chores in their own room. Roommates are trusted with each other's chores.
- **Enforced in the database:** row level security is on for every table. Hiding buttons in the UI is never the only protection. Policies use a `security definer` helper, `is_room_member`, with an empty `search_path`.
- **Entering a room:** clients cannot insert into `rooms` or `members` directly. `create_room` and `join_room` do it, and `join_room` is the only way to look a room up by its code, so codes cannot be listed.
- **Keys:** the app uses only the Supabase URL and the publishable key, which are safe in the browser because row level security limits what they can reach. No secret or service-role key is used or committed. `.env.local` is git-ignored.
- **Review:** an automated review of the code against the spec found two issues (inconsistent completion data, and guessable join codes). Both were fixed in follow-up migrations rather than by editing the first one.

Known limits: join-code attempts are limited per account, which slows guessing but does not stop someone who creates many accounts. A user belongs to one room.

## Database migrations
SQL files are in `supabase/migrations/`, numbered in the order they were applied:
1. Tables, row level security policies, `is_room_member`, `create_room`, `join_room`.
2. Checks that completion data is consistent and belongs to the same room.
3. Larger join-code alphabet and a limit on failed join attempts.

Supabase does not apply these when code is pushed. Each file is pasted into the Supabase SQL editor by hand.

## Local setup
1. `npm ci`
2. Create a Supabase project and apply the migrations in order.
3. Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
   ```
4. In Supabase, Authentication: enable the Email provider. For quick sign-up, turn off "Confirm email". Set the Site URL, and add `http://localhost:3000/**` and your deployed URL with `/**` to Redirect URLs.
5. `npm run dev`, then open http://localhost:3000

On Vercel, set the same two variables in the project's environment settings. Never add a secret key to this app.

Checks: `npm run lint` and `npm run build`. If Turbopack cannot start in a restricted environment, `npm run build -- --webpack` uses the alternate bundler.

## Not built (on purpose)
Recurring chores, notifications, points, photos, AI features, roles, leaving or deleting a room, multiple rooms per user, realtime updates and dark mode. The goal was a small app that works end to end.

## How it was built
Work was split into small steps, each on its own branch and merged by pull request: database and security rules, sign-in and rooms, the chore board, edit/delete/filters, a design pass, and a review step. See the [pull requests](https://github.com/asherwu21-grop/chorecycle/pulls) and the commit history.
