# Signup Funnel Nav Lock Design

## Goal

Hide sidebar nav links during billing and onboarding so new users follow a linear setup funnel — plan selection → Stripe → onboarding → full dashboard. On the marketing site, direct Sign Up / CTA clicks to scroll to the pricing section so users pick a plan before creating an account.

## Architecture

Add a `navLocked` boolean option to `pageShell.js`. When true, the sidebar renders the logo and logout only — all nav links are replaced with a muted "Complete setup to unlock your dashboard" placeholder. The onboarding guard continues to enforce route access; this change is purely cosmetic/UX.

## Components

### 1. `src/ui/pageShell.js`
- Accept `navLocked` in the options object (default `false`)
- When `navLocked: true`:
  - Replace the full nav list with a single muted lock message
  - Hide the location initials chip
  - Keep logout link visible
- When `navLocked: false` (default): no change to existing behavior

### 2. `src/routes/billing.js`
- In the `GET /manager/billing` route, check `salon.status === 'setup_incomplete'`
- If true, pass `navLocked: true` to `pageShell()`
- Existing account billing visits (status !== 'setup_incomplete') get full nav as before

### 3. `src/routes/onboarding.js`
- Confirm whether onboarding pages call `pageShell()` or use their own minimal shell
- If they call `pageShell()`: pass `navLocked: true` on all step routes
- If they use their own shell: verify no nav links are present; add locked message if needed

### 4. `mostlypostly-site/index.html`
- Hero CTA button (`#mp-hero-cta`) → change href target to `#pricing` (scroll to pricing section)
- Nav "Sign Up" buttons (`#mp-signup`, `#mp-signup-mobile`) → change href target to `#pricing`
- Plan buttons (Starter / Growth / Pro) remain unchanged — they already link to `/manager/signup?plan=X`

## Data Flow

```
User clicks "Sign Up" on site
  → scrolls to #pricing section
  → clicks plan card → /manager/signup?plan=starter|growth|pro
  → creates account, email verification
  → /manager/billing?new=1 (navLocked sidebar — no nav links)
  → completes Stripe checkout
  → /onboarding/salon (navLocked sidebar — no nav links)
  → completes all 6 onboarding steps
  → /onboarding/complete sets status='active', status_step='complete'
  → redirects to /manager (full nav now visible)
```

## Error Handling

- If user navigates directly to a blocked route during setup: `onboardingGuard` redirects them back (unchanged)
- If Stripe checkout is abandoned: user returns to `/manager/billing?new=1` with locked nav, can retry
- Logout always visible — user is never trapped

## Testing

- [ ] Sign up fresh account → billing page shows no nav links
- [ ] Complete Stripe checkout → onboarding pages show no nav links
- [ ] Complete onboarding → dashboard shows full nav
- [ ] Existing account visits `/manager/billing` → full nav visible
- [ ] Site hero CTA → scrolls to pricing section
- [ ] Site nav Sign Up → scrolls to pricing section
- [ ] Plan card buttons still navigate to `/manager/signup?plan=X`
