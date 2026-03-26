# Deployment Environment Checklist

Use this checklist before promoting changes from local to staging and from staging to production.

## 1) Environment Topology

- Use separate environments for:
  - Local development (`.env.local`)
  - Staging (Vercel staging project)
  - Production (Vercel production project)
- Do not share production secrets with staging.

## 2) Canonical App URL

- Set `NEXT_PUBLIC_APP_URL` explicitly in staging and production.
  - Staging example: `https://staging.your-domain.com`
  - Production example: `https://app.your-domain.com`
- Confirm links generated in invites and emails point to the correct environment domain.

## 3) Supabase Configuration

- Required in all environments:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY`
- Verify staging and production each point to the intended Supabase project.
- Never expose `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` to browser code.

## 4) Xero Configuration

- Required:
  - `XERO_CLIENT_ID`
  - `XERO_CLIENT_SECRET`
  - `XERO_REDIRECT_URI`
- `XERO_REDIRECT_URI` must exactly match the callback URI configured in the Xero app.
- Validate Xero app credentials are isolated by environment where possible.

## 5) Resend Configuration

- Required:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- Ensure sending domain and sender address are verified in Resend.

## 6) Pre-Release Validation

- Confirm env parity between staging and production (same keys, environment-specific values).
- Run smoke checks in staging:
  - Login/logout
  - Invite user flow
  - Booking confirmation/update email links
  - Xero connect callback
- Promote only after staging checks pass.
