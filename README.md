# ChoreCycle

Shared chores for roommates, built with Next.js and Supabase.

## Local setup

1. Install dependencies with `npm ci`.
2. Set these two public variables in the git-ignored `.env.local` file:
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
   ```
3. Apply `supabase/migrations/001_init.sql` to your Supabase project if step 1 has not already been applied. It defines the tables, RLS policies, and `create_room` / `join_room` RPCs.
4. In Supabase Authentication, enable the Email provider. Set the Site URL and allow `http://localhost:3000/auth/callback` under Redirect URLs. Add the equivalent HTTPS callback URL for your deployed site. The standard confirmation email template uses `{{ .ConfirmationURL }}`. Keep that template when using this PKCE callback.
5. Run `npm run dev` and open http://localhost:3000.

When email confirmation is enabled, follow the confirmation link in the same browser used to sign up so the PKCE verifier cookie is available. Confirmation failures appear on `/login`; after confirming an account, you can also sign in with its email and password.

For Vercel, set the same two public environment variables in project settings before deploying. Never set a privileged Supabase key in this app. Restart the local server or redeploy after changing environment variables.

## Step 2 behavior

- `/login`: email/password sign up and sign in, inline errors and email-confirmation feedback.
- `/start`: create a room or join by its six-character code, with a required display name. Room entry uses the existing database RPCs; database RLS enforces access.
- `/`: shows the signed-in user's room name. The chore board is a later build step.
- Server pages verify auth claims and membership: signed-out users go to `/login`, users without a room go to `/start`, and room members go to `/`. The Next.js proxy refreshes session cookies.

## Checks

```sh
npm run build
npm run lint
```

If Turbopack cannot bind its internal worker port in a restricted environment, `npm run build -- --webpack` runs the alternate production bundler. Both builders may need network access for the existing Google fonts.

To check the live setup, use two accounts: create a room with the first account, join with the second using the room's `join_code` from the Supabase dashboard, and confirm both land on the same room name after reloading. Also check a wrong join code, wrong password, email confirmation, and sign out. The board header that displays the code is outside step 2.
