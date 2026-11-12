# FLYWAYSGO — Manual Flight Booking & Ticket Issuing Platform

**Tagline:** Fly More. Pay Less.  
**Currency:** INR (₹) · **Market:** India

This is an independent manual ticket-issuing booking platform. Customers choose a listed flight, enter passenger details and a seat preference, pay through the configured merchant gateway, and receive a booking request. An administrator independently arranges the actual ticket and uploads the confirmed ticket PDF/PNR. Payment alone never means a ticket has been issued.

## Important operating rules

- Demo flights are clearly labelled **DEMO — NOT BOOKABLE**. They are not live airline/GDS inventory.
- Only publish flights and fares that you are authorized to sell and have manually verified.
- Seat selection is a **preference/request**, not a guaranteed airline seat reservation.
- Discounts and coupon savings are calculated by the server from configured reference/selling fares. Do not advertise a discount unless the reference fare is genuine and documented.
- Payment is verified server-side using Razorpay signature verification and webhook signature verification.
- A booking becomes `TICKET_ISSUED` only after an admin uploads the confirmed ticket and enters the PNR/ticket number.
- Do not accept real payments until business/KYC, refund policy, privacy/terms, tax, supplier arrangements, and production security have been reviewed.

## Project structure

- `client/` — React + Vite customer site and admin dashboard
- `server/` — Node.js + Express API
- `supabase/schema.sql` — database tables, RLS policies and storage bucket
- `.github/workflows/deploy-pages.yml` — deploys the frontend to GitHub Pages
- `SETUP-HINDI.md` — iPad-friendly setup guide

## Local development

Requirements: Node.js 20+ and npm.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Create the first admin in Supabase Auth. Copy that user's UUID into `admin_users` using the SQL snippet in `SETUP-HINDI.md`.
4. Copy `server/.env.example` to `server/.env` and fill the Supabase URL, service role key, Razorpay keys, and frontend URL.
5. Copy `client/.env.example` to `client/.env` and fill the Supabase URL and anon key.
6. In one terminal:
   ```bash
   cd server && npm install && npm run dev
   ```
7. In another terminal:
   ```bash
   cd client && npm install && npm run dev
   ```
8. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

## Deployment

GitHub Pages can host **only the frontend**. Deploy `client/` using the included GitHub Actions workflow. Deploy `server/` separately to a Node.js host that supports persistent environment variables and HTTPS. Set `VITE_API_URL` to the deployed API URL before building, and set the API's `FRONTEND_URL` to your deployed website URL.

For a repository named `flyway`, the workflow uses the `/flyway/` base path. If you rename the repository, update `BASE_PATH` in `.github/workflows/deploy-pages.yml`.

## Required production configuration

- Supabase Auth, database and private `tickets` storage bucket
- Supabase service role key on the server only — **never put it in frontend code**
- Razorpay key ID and secret on server; key ID may be placed in frontend env
- Razorpay webhook URL: `https://YOUR-API-DOMAIN/api/payments/webhook`
- Configure webhook secret and subscribe to `payment.captured` and `payment.failed`
- Configure CORS `FRONTEND_URL`, HTTPS, admin users and refund/support processes
- Replace all demo flight data with verified listings before accepting bookings

## API overview

- `GET /api/health`
- `GET /api/flights` — demo sample flights; marked non-bookable
- `POST /api/bookings` — create booking request after server-side fare/coupon calculation
- `POST /api/payments/order` — create Razorpay order for a pending booking
- `POST /api/payments/verify` — verify checkout signature
- `POST /api/payments/webhook` — verify Razorpay webhook
- `GET /api/bookings/:id/status` — public booking status lookup using booking reference + email
- `GET /api/admin/bookings` — admin only
- `PATCH /api/admin/bookings/:id/status` — admin only
- `POST /api/admin/bookings/:id/ticket` — admin only; upload confirmed ticket PDF

This is a practical starter implementation, not a substitute for a professional security/payment compliance review.
