# SAATHCHALO — Real Supabase Backend Setup Guide

This guide explains how to connect your **Supabase** project to enable real multi-user authentication, real-time community chat, live destination voting, shared ride pooling, and live telemetry across multiple devices.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New Project**.
3. Name your project (e.g. `saathchalo-platform`) and set a secure database password.
4. Select your preferred region (e.g. *Central India / Mumbai* or closest region) and click **Create new project**.

---

## 2. Obtain Your API Keys

1. In your Supabase Dashboard, navigate to **Project Settings** (gear icon) → **API**.
2. Copy the following two values:
   - **Project URL** (e.g., `https://abcdefghijklm.supabase.co`)
   - **Project API Keys** → `anon` `public` key (e.g., `eyJhbGciOi...`)

---

## 3. Configure Environment Variables

Open or create `.env` in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-actual-anon-public-key
```

> **Security Note:** Never expose the `service_role` secret key. Only use the public `anon` key.

---

## 4. Run Database Migrations in SQL Editor

1. In your Supabase Dashboard, go to the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open [`supabase-schema.sql`](file:///C:/Users/ngfsa/.gemini/antigravity-ide/scratch/saathchalo/supabase-schema.sql) from this repository, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run** (or `Ctrl+Enter`).
5. Confirm that all tables (`profiles`, `communities`, `messages`, `votes`, `rides`, `ride_participants`, `shuttles`, etc.), Row Level Security (RLS) policies, and Realtime publications have been created successfully.

---

## 5. Enable Email Authentication (Instant Demo Mode)

By default, Supabase requires users to confirm their email address via a verification link before logging in. For hackathon and instant multi-device testing:

1. In Supabase Dashboard, go to **Authentication** → **Providers** → **Email**.
2. Turn **OFF** the toggle for **Confirm email**.
3. Click **Save**.
4. *(Now any teammate can register with any email on their phone or laptop and immediately sign in!)*

---

## 6. Verify Realtime Publication

1. In Supabase Dashboard, navigate to **Database** → **Replication**.
2. Click on the `supabase_realtime` publication.
3. Verify that the following tables have realtime enabled (the SQL migration automatically activates this):
   - `messages`
   - `votes`
   - `vote_sessions`
   - `rides`
   - `ride_participants`
   - `shuttles`

---

## 7. Verify Storage Bucket

1. In Supabase Dashboard, go to **Storage** → **Buckets**.
2. Confirm the **`avatars`** bucket exists with **Public** access enabled.
3. If not already present, click **New Bucket**, name it `avatars`, toggle **Public bucket** ON, and save.

---

## 8. Multi-Device Verification Test

Once configured:
1. **Device A (Laptop):** Open the website, click **Register**, create an account (e.g. `Aditya`), select `Knowledge Park`.
2. **Device B (Phone 1):** Open the public link, click **Register**, create an account (e.g. `Anshika`), select `Knowledge Park`.
3. **Device C (Phone 2):** Open the public link, click **Register**, create an account (e.g. `Rahul`), select `Knowledge Park`.
4. Open **Knowledge Park Community** on all three devices:
   - Send a message from Device A: Device B and C receive it **instantly in real time**.
   - Cast a vote for `Pari Chowk` from Device B: Device A and C see the live vote count update **without refreshing**.
   - Confirm the ride: All 3 users are pooled into the **same shared ride** with auto vehicle allocation and live tracking!
