# ReviewBee

ReviewBee is a free peer review app for Meta Ads campaign setup checks. A user submits only a Meta Ads Manager link, another user manually opens the link, completes a checklist, and submits a review. Campaign owners receive in-app inbox notifications only.

ReviewBee does not use the Meta API, does not send email notifications for reviews, and does not require a paid backend.

## Features

- Username and password sign up, login, and logout with Supabase Auth
- Campaign submission with an Ads Manager link, nickname, and reviewer notes
- Review queue that shows one available campaign at a time
- Required checklist review flow with Pass, Fail, and Not Sure choices
- In-app inbox notifications when a campaign is reviewed
- Inbox and dashboard review summaries show the campaign link, reviewer, and whether the campaign passed or failed
- Failed reviewed campaigns can be resubmitted into the review queue
- Browser notifications while the app is open, when the user allows alerts
- Review stats for all time, this week, and this month
- Campaign detail pages where owners can view reviews and checklist results
- Supabase Row Level Security policies for private campaign and review data
- GitHub Pages deployment with GitHub Actions

## Tech stack

- React
- Vite
- TypeScript
- Supabase Auth and Database
- React Router with `HashRouter`
- Plain CSS
- GitHub Pages and GitHub Actions

## Local setup

1. Clone the repo:

   ```bash
   git clone https://github.com/Teancum1820/ReviewBee.git
   cd ReviewBee
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a Supabase project:

   - Go to [supabase.com](https://supabase.com/).
   - Create a free account or log in.
   - Create a new project.
   - Wait for the project to finish provisioning.
   - Go to **Authentication** > **Providers** > **Email**.
   - Turn off **Confirm email**. ReviewBee uses username sign-in, so users do not verify an email address.

4. Find your Supabase Project URL and anon key:

   - Open your Supabase project.
   - Go to **Project Settings**.
   - Open **API**.
   - Copy the **Project URL**.
   - Copy the **anon public** key.

5. Create `.env.local` in the project root:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Do not commit `.env.local`.

6. Set up the database:

   - In Supabase, open **SQL Editor**.
   - Create a new query.
   - Copy everything from `supabase/schema.sql`.
   - Paste it into the SQL Editor.
   - Click **Run**.

7. Start the app:

   ```bash
   npm run dev
   ```

8. Open the local URL shown by Vite.

## Testing with two users

Use two different user accounts. You can use two browsers, one normal window plus one private window, or log out between steps.

- User A signs up or logs in with a username and password.
- User A submits a campaign.
- User B signs up or logs in with a different username and password.
- User B opens the Review Queue and reviews User A's campaign.
- User A receives an inbox notification.
- User A opens the campaign detail page to see the review.
- User B's review stats increase.

ReviewBee creates an internal Supabase Auth email from each username, but users never enter or verify an email address. Browser notifications work while the app is open after the user clicks **Enable alerts** and allows notifications in the browser.

## Push to GitHub

After making changes:

```bash
git add .
git commit -m "Build ReviewBee app"
git push origin main
```

## GitHub Pages deployment

This repo includes `.github/workflows/deploy.yml`. It builds the Vite app and deploys the `dist` folder to GitHub Pages on every push to `main`.

To enable GitHub Pages:

1. Open the GitHub repository.
2. Go to **Settings**.
3. Open **Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.

## GitHub Actions Supabase variables

The deploy workflow needs these values at build time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

You can add them as repository secrets:

1. Go to **Settings**.
2. Open **Secrets and variables**.
3. Open **Actions**.
4. Add repository secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

You can also add them as repository variables with the same names. The workflow checks both secrets and variables.

## GitHub Pages base path

`vite.config.ts` uses `/ReviewBee/` as the production base path. If you rename the repository, update the `repositoryName` value in `vite.config.ts` or set `VITE_BASE_PATH` during the build.

React Router uses `HashRouter`, so page refreshes work on GitHub Pages.

## Common troubleshooting

- **Blank page on GitHub Pages:** Check that the repository name matches the base path in `vite.config.ts`.
- **Cannot sign in:** Confirm `.env.local` has the correct Supabase Project URL and anon key.
- **Sign up says to confirm email:** Supabase email confirmation is enabled. Turn off **Confirm email** under **Authentication** > **Providers** > **Email**.
- **Database insert is blocked:** Make sure `supabase/schema.sql` was run successfully and Row Level Security policies were created.
- **Review queue is empty:** You need a campaign submitted by a different user. Users cannot review their own campaigns.
- **Duplicate review blocked:** Each user can review a campaign only once.
- **No inbox notification:** Notifications are created by the database trigger after a review is inserted. Confirm the trigger was created by rerunning `supabase/schema.sql`.
- **No browser notification:** Keep ReviewBee open in a browser tab, click **Enable alerts**, and allow notifications. Browser notifications depend on Supabase Realtime, so rerun `supabase/schema.sql` after pulling version 1.2 changes.
- **Build fails in GitHub Actions:** Confirm the Actions secrets or variables are set and named exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
