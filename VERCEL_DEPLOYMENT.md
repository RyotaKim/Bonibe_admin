# Vercel Deployment Guide

## Step 1: Push to GitHub
1. Open terminal in the project folder
2. Verify remote is set:
   ```
   git remote -v
   ```
3. If needed, add your GitHub repository:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/bonibe_admin.git
   ```
4. Commit and push:
   ```
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push -u origin main
   ```

## Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in (or create an account if needed)
3. Click **"Add New..."** → **"Project"**
4. Select **"Import Git Repository"**
5. Connect your GitHub account if prompted
6. Select the `bonibe_admin` repository
7. Click **"Import"**

## Step 3: Configure Environment Variables
In the Vercel import dialog:
1. Under **"Environment Variables"**, add both values:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://fzimvjokkafmrocxrlwe.supabase.co`

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aW12am9ra2FmbXJvY3hybHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDM2NzcsImV4cCI6MjA5NTcxOTY3N30.crDrFrnihzakpJqDVUQT6hOsgascKiTgJlLk-3qe5Ag`

2. Click **"Deploy"**

## Step 4: Verify Deployment
- Vercel will automatically build and deploy your project
- You'll see a deployment progress screen
- Once complete, you'll get a live URL (typically `https://bonibe-admin-*.vercel.app`)

## Future Deployments
- Any push to your main branch will trigger automatic redeployment
- Manage environment variables in Vercel dashboard → Project Settings → Environment Variables

## Security Notes
- ✅ `.env.local` is in `.gitignore` and won't be committed
- ✅ `vercel.json` declares required env vars for security transparency
- ⚠️  Supabase anon-key is safe for browser use (RLS protected in database)
