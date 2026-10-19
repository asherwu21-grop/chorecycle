# ChoreCycle
Shared chore board for college roommates. A user signs up, creates or joins a room with a join code, and everyone in the room sees one list of chores: add, assign, set a due date, mark done, filter. Most use is on a phone.

Read SPEC.md before every task. It defines the data model, security rules, design brief and build steps.

## Commands
- Run: npm run dev
- Build: npm run build
- Lint: npm run lint

## Stack
Next.js (App Router) with TypeScript, Tailwind CSS, Supabase (Postgres and Auth), deployed on Vercel.

## Rules
- Work on a branch, never on main. Do one build step from SPEC.md at a time and stop when it is done.
- Permissions are enforced by row level security in the database. Never rely on hiding buttons.
- Never use or write the Supabase service-role (secret) key anywhere. The app uses only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Never commit .env.local.
- Schema changes go in supabase/migrations/ as SQL files, not only in the dashboard.
- Show every error to the user. Do not log and continue.
- Phone first. Tap targets at least 44px.
- Ask before you add a dependency. Already approved: @supabase/supabase-js, @supabase/ssr.
- Real copy only: no placeholder text, invented stats, or emoji as icons. Button labels say what happens ("Add chore", not "Submit").
- Before you say a task is done, run npm run build and npm run lint and show the output. Never claim something works unless you ran it.
- When a step needs me to do something by hand (Supabase dashboard, Vercel settings), say so clearly and wait.
