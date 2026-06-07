# Google Authentication Setup Guide

## Overview

The Autonomous-Lead system now includes a secure Google OAuth authentication system that:
- ✅ Restricts access to a single authorized Google account
- ✅ Provides a beautiful, premium login page with split-screen design
- ✅ Automatically redirects unauthorized users
- ✅ Includes session management and user header
- ✅ Logs all authentication events for security

---

## Architecture

### Components

| File | Purpose |
|------|---------|
| `middleware.ts` | Protects `/autonomous` routes, redirects to login if not authenticated |
| `app/login/page.tsx` | Beautiful login page with error handling |
| `app/login/components/LoginForm.tsx` | Google OAuth sign-in button (client component) |
| `app/auth/callback/route.ts` | OAuth callback handler that validates email |
| `app/auth/signout/route.ts` | Sign-out endpoint |
| `lib/auth/context.tsx` | React context for managing auth state |
| `app/(authenticated)/layout.tsx` | Layout wrapper for authenticated routes |
| `app/(authenticated)/components/Header.tsx` | User header with sign-out menu |

### Flow Diagram

```
1. User visits /autonomous
   ↓ (No session)
2. Middleware redirects to /login
   ↓
3. User clicks "Continue with Google"
   ↓
4. Google OAuth sign-in window opens
   ↓
5. Supabase receives OAuth callback → /auth/callback
   ↓
6. System checks: email === AUTHORIZED_ADMIN_EMAIL?
   ├─ NO → Sign out, redirect /login?error=unauthorized
   └─ YES → Redirect to /autonomous
```

---

## Setup Instructions

### Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google+ API** (if not already enabled)
4. Go to **APIs & Services > OAuth consent screen**
   - Choose **External** user type
   - Fill in:
     - App name: "GROW Autonomous Lead Discovery"
     - User support email: Your email
     - Developer contact: Your email
   - Add test user: `manavbhavsar2005@gmail.com` (or your authorized email)
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > OAuth 2.0 Client ID**
7. Select **Web application**
8. Add authorized redirect URI:
   ```
   https://<YOUR_SUPABASE_PROJECT_ID>.supabase.co/auth/v1/callback
   ```
   - Find your Project ID in Supabase Dashboard URL
9. Copy the **Client ID** and **Client Secret**

### Step 2: Supabase Configuration

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **Autonomous-Lead** project
3. Go to **Authentication > Providers**
4. Click on **Google** and toggle **Enable Sign in with Google**
5. Paste your Google **Client ID** and **Client Secret**
6. Click **Save**

### Step 3: Environment Variables

Your `.env.local` should include:

```bash
# Supabase (Autonomous Project)
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL=https://cigeghddmtdqgsxzkzxo.supabase.co
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY=eyJhbGc...

# Authorized admin email (single account only)
AUTHORIZED_ADMIN_EMAIL=manavbhavsar2005@gmail.com
```

> ⚠️ **Critical**: Ensure `AUTHORIZED_ADMIN_EMAIL` is set in `.env.local`. Without it, login will fail.

### Step 4: Test the Setup

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Visit the login page:**
   ```
   http://localhost:3000/login
   ```

3. **Click "Continue with Google"**
   - If in "Testing" mode (hasn't been published), only test users can sign in
   - Sign in with the **authorized email**

4. **Verify redirect to `/autonomous`**
   - If you see the dashboard, authentication is working!

5. **Test unauthorized access:**
   - Sign out
   - Try signing in with a different Google account
   - You should see: *"Unauthorized: This Google account does not have access."*

---

## Configuration

### Change Authorized Email

To allow a different Google account:

1. Update `.env.local`:
   ```bash
   AUTHORIZED_ADMIN_EMAIL=newemail@gmail.com
   ```

2. Restart the dev server

3. If needed, update the test user in Google Cloud Console's OAuth consent screen

### Change Login Redirect URL

The callback route uses:
```typescript
redirectTo: `${window.location.origin}/auth/callback`
```

This automatically adapts to your deployment URL (localhost:3000, production domain, etc.)

### Session Management

Sessions are automatically managed by Supabase. The `AuthProvider` context:
- Loads the session on app startup
- Listens for auth state changes
- Provides `useAuth()` hook for accessing user data

---

## Security Features

### Authentication
- ✅ Google OAuth 2.0 (industry-standard)
- ✅ Single-email restriction (hardened via `AUTHORIZED_ADMIN_EMAIL`)
- ✅ Automatic session management via Supabase

### Authorization
- ✅ Middleware checks session before allowing `/autonomous`
- ✅ Callback validates email before confirming login
- ✅ Unauthorized users are signed out immediately

### Logging
All auth events are logged with `[Auth/*]` prefix:
```
[Auth/Callback] User authorized: manavbhavsar2005@gmail.com
[Auth/Callback] Unauthorized login attempt: otheremail@gmail.com
```

Check browser console (dev tools) for auth flow details.

---

## Troubleshooting

### Issue: "Redirect URI mismatch"
**Solution:** Ensure the redirect URI in Google Cloud matches your Supabase project:
```
https://<PROJECT_ID>.supabase.co/auth/v1/callback
```

### Issue: "Invalid API Key"
**Solution:** Verify `.env.local` has correct Supabase credentials:
```bash
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL=...
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY=...
```

### Issue: Stuck on login page after clicking Google button
**Solution:** 
1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Ensure Google OAuth is enabled in Supabase Dashboard
4. Clear cookies and try again

### Issue: "Unauthorized" error after signing in
**Solution:** 
1. Verify `AUTHORIZED_ADMIN_EMAIL` in `.env.local` matches your Google account email
2. Check Google account email case sensitivity
3. Update test users in Google Cloud OAuth consent screen if needed

### Issue: Session lost after refresh
**Solution:** This is normal during development. The session is stored in cookies. If completely lost:
1. Clear browser cookies for localhost:3000
2. Sign in again
3. Check that `@supabase/ssr` is installed: `npm ls @supabase/ssr`

---

## API Endpoints

### Public Routes (No Auth Required)
- `GET /login` — Login page
- `GET /auth/callback` — OAuth callback handler
- `POST /auth/signout` — Sign-out endpoint

### Protected Routes (Auth Required)
- `GET /autonomous` — Main dashboard
- `POST /api/autonomous/run` — Start discovery (also has API key guard)

---

## Using the Auth Context in Components

### In a Client Component

```typescript
'use client'

import { useAuth } from '@/lib/auth/context'

export function MyComponent() {
  const { user, isLoading, signOut } = useAuth()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>Hello, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### Available Context Values
- `user: { id: string; email: string } | null` — Current user or null
- `isLoading: boolean` — Whether session is being loaded
- `signOut(): Promise<void>` — Sign out the current user

---

## Deployment Checklist

Before deploying to production:

- [ ] Google OAuth app is **published** (not in "Testing" mode)
- [ ] Add test/admin emails to Google OAuth consent screen if in Testing mode
- [ ] Update `AUTHORIZED_ADMIN_EMAIL` in production `.env`
- [ ] Add production domain to Google Cloud OAuth redirect URIs
- [ ] Test sign-in on production domain
- [ ] Verify logs show correct authorization
- [ ] Set up monitoring/alerts for unauthorized login attempts

---

## Next Steps

### Phase 2 Enhancements
- [ ] Add password-less email magic links (alternative to Google)
- [ ] Implement admin user roles/permissions
- [ ] Add audit log of all logins and sign-outs
- [ ] Email notifications for new authorized logins
- [ ] IP allowlisting (optional security hardening)

### Integration Points
The authentication system integrates with:
- ✅ Protected `/autonomous` dashboard
- ✅ User header component showing email
- ✅ Session management for all protected routes
- Ready for: admin approval workflows, team assignment, etc.

---

## Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review browser console logs (prefix: `[Auth/*]`, `[AuthProvider]`)
3. Verify `.env.local` configuration
4. Check Supabase Dashboard for auth logs
5. Verify Google Cloud OAuth configuration

---

**Last Updated:** 2026-06-05  
**Status:** ✅ Ready for testing and deployment
