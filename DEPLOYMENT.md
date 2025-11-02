# Deployment Guide to Whop

## Step 1: Set Environment Variables in Netlify/Vercel

### For Netlify:

1. Go to your Netlify project dashboard
2. Navigate to **Site configuration** → **Environment variables** (or **Build & deploy** → **Environment**)
3. Click **Add variable** and add these:

   **Required Variables:**
   - `WHOP_API_KEY` - Your Whop API Key (from Whop Developer Dashboard → API Keys)
   - `NEXT_PUBLIC_WHOP_APP_ID` - Your Whop App ID (from Whop Developer Dashboard → Settings)

   **Optional (if using webhooks):**
   - `WHOP_WEBHOOK_SECRET` - Your webhook secret (from Whop Developer Dashboard → Webhooks)

4. **IMPORTANT:** After adding variables, you must **trigger a new deploy**:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**

### For Vercel:

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add the same variables as above
3. **Redeploy** after adding variables

## Step 2: Deploy

### For Netlify:

1. If your GitHub repo is connected, push a commit to trigger auto-deploy:
   ```bash
   git push origin main
   ```

2. Or manually trigger a deploy:
   - Go to **Deploys** tab → **Trigger deploy** → **Deploy site**

3. Wait for the build to complete (check build logs)

### For Vercel:

1. Push to GitHub (if connected) or manually redeploy
2. Wait for deployment to complete

## Step 3: Get Your Deployment URL

### Netlify:
- Your site URL is in the Netlify dashboard (e.g., `https://your-app.netlify.app`)
- Or go to **Site configuration** → **General** → **Site details**

### Vercel:
- Copy your production URL (e.g., `https://your-app.vercel.app`)

## Step 4: Configure in Whop Developer Dashboard

1. Go to [Whop Developer Dashboard](https://whop.com/dashboard/developer/)
2. Select your app
3. Go to **Hosting** section
4. Update these settings:

   **Base URL:** Your deployment URL
   - Netlify: `https://your-app.netlify.app`
   - Vercel: `https://your-app.vercel.app`

   **App path:** `/experiences/[experienceId]`

   **Dashboard path:** `/dashboard/[companyId]`

   **Discover path:** `/discover`

5. If you're using webhooks, go to **Webhooks** section:
   - **Webhook URL:** `https://your-app.netlify.app/api/webhooks` (or your Vercel URL)

## Step 5: Verify Deployment

1. Go to a Whop company where your app is installed
2. Navigate to the app (via Tools section or experience)
3. Test that:
   - The app loads correctly
   - Users can see the leaderboard
   - Admins can create/assign badges
   - All members appear in the list

## Troubleshooting

**Build failing with "WHOP_API_KEY is not set"?**
- ✅ **FIXED**: The code now handles missing env vars during build
- Still make sure to add environment variables in Netlify/Vercel
- After adding variables, trigger a new deploy

**App not loading?**
- Check that Base URL is set correctly in Whop Dashboard
- Verify environment variables are set in your hosting platform
- Check deployment logs for errors

**Environment variables not working?**
- Make sure to **trigger a new deploy** after adding variables
- Check variable names are exactly as shown (case-sensitive)
- Verify values are correct in your hosting platform's settings
- For Netlify: Variables are available at build time automatically
- For Vercel: Ensure variables are set for the correct environment (Production)

**Build errors?**
- Check deployment build logs
- Ensure `pnpm` is selected as package manager (Netlify auto-detects, Vercel needs configuration)
- Verify all dependencies are in `package.json`



