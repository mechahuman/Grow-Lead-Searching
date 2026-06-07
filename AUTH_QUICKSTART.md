# Google Authentication - Quick Start

## What Was Implemented ✅

A complete Google OAuth authentication system for the Autonomous-Lead project with:

- **Beautiful Login Page** — Split-screen design with GROW branding, error handling, and premium styling
- **Single Email Restriction** — Only `manavbhavsar2005@gmail.com` can access (configurable via env var)
- **Protected Routes** — Middleware automatically redirects unauthorized users to `/login`
- **User Session Management** — React context for auth state, automatic session loading
- **User Header** — Shows logged-in email with sign-out menu on authenticated pages
- **Security** — Logs all auth attempts, signs out unauthorized users immediately

---

## Files Created

```
middleware.ts                          # Protects /autonomous routes
app/login/page.tsx                     # Login page UI
app/login/components/LoginForm.tsx     # Google OAuth button
app/auth/callback/route.ts             # OAuth callback handler
app/auth/signout/route.ts              # Sign-out endpoint
lib/auth/context.tsx                   # Auth state management
app/(authenticated)/layout.tsx         # Authenticated routes layout
app/(authenticated)/components/Header.tsx # User header + menu
AUTHENTICATION.md                      # Full setup guide
.env.local                             # Updated with AUTHORIZED_ADMIN_EMAIL
```

---

## 3-Minute Setup

### 1. Google Cloud Console (5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services > OAuth consent screen**
   - User type: External
   - App name: "GROW Autonomous Lead"
   - Emails: your-email@gmail.com
   - Add test user: manavbhavsar2005@gmail.com
3. **APIs & Services > Credentials**
   - Create OAuth 2.0 Client ID (Web application)
   - Add redirect URI: `https://cigeghddmtdqgsxzkzxo.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret

### 2. Supabase Dashboard (2 minutes)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select Autonomous-Lead project
3. **Authentication > Providers > Google**
   - Toggle: Enable
   - Paste Client ID and Secret
   - Save

### 3. Start Dev Server (1 minute)

```bash
npm run dev
```

Visit: http://localhost:3000/login

---

## Testing the Setup

### ✅ Authorized User Flow
1. Click "Continue with Google"
2. Sign in with `manavbhavsar2005@gmail.com`
3. Redirected to `/autonomous` dashboard ✓

### ❌ Unauthorized User Flow
1. Click "Continue with Google"
2. Sign in with **different** Google account
3. See error: "Unauthorized: This Google account does not have access"
4. Automatically signed out ✓

### Sign Out
1. Click user avatar in top-right
2. Click "Sign Out"
3. Redirected to login page ✓

---

## Configuration

### Change Authorized Email

Edit `.env.local`:
```bash
AUTHORIZED_ADMIN_EMAIL=newemail@gmail.com
```

Restart dev server. That's it!

### Local Development

The middleware **only protects `/autonomous` routes**. These remain public:
- `/login` — Always accessible
- `/auth/callback` — OAuth callback (needed for sign-in)
- `/auth/signout` — Sign-out endpoint

---

## How It Works

```
User visits /autonomous
    ↓ (no session)
Middleware redirects to /login
    ↓
User clicks "Continue with Google"
    ↓
Google OAuth flow (browser handles)
    ↓
Callback to /auth/callback
    ↓
Email check: matches AUTHORIZED_ADMIN_EMAIL?
    ├─ NO → Sign out + redirect /login?error=unauthorized
    └─ YES → Redirect /autonomous ✓
```

---

## Security Features

✅ **Google OAuth 2.0** — Industry standard  
✅ **Single-email restriction** — Hardened via AUTHORIZED_ADMIN_EMAIL env var  
✅ **Middleware protection** — Checks session before allowing access  
✅ **Callback validation** — Verifies email before confirming login  
✅ **Immediate sign-out** — Unauthorized users signed out automatically  
✅ **Logging** — All events logged with `[Auth/*]` prefix  

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Redirect URI mismatch" | Ensure URI matches: `https://cigeghddmtdqgsxzkzxo.supabase.co/auth/v1/callback` |
| Stuck on login button | Clear cookies, check console for errors |
| "Unauthorized" error | Verify `AUTHORIZED_ADMIN_EMAIL` in `.env.local` |
| Session lost on refresh | Normal during dev. Clear cookies and sign in again. |

For detailed troubleshooting, see [AUTHENTICATION.md](./AUTHENTICATION.md#troubleshooting)

---

## What's Next

### Before Production
- [ ] Publish OAuth app (currently in Testing mode)
- [ ] Test on production domain
- [ ] Add production domain to Google OAuth URIs

### Future Enhancements
- [ ] Email magic links (passwordless alternative)
- [ ] Admin roles/permissions
- [ ] Audit logs for all logins
- [ ] IP allowlisting

---

## Need Help?

1. **Full setup guide:** See [AUTHENTICATION.md](./AUTHENTICATION.md)
2. **Troubleshooting:** See [AUTHENTICATION.md#troubleshooting](./AUTHENTICATION.md#troubleshooting)
3. **Security details:** See [AUTHENTICATION.md#security-features](./AUTHENTICATION.md#security-features)

---

**Status:** ✅ Ready to use  
**Build:** ✅ Compiles successfully  
**Dependencies:** ✅ All installed (@supabase/ssr, @supabase/supabase-js)

🎉 You're all set! Follow the **3-Minute Setup** above to get Google Login working.
