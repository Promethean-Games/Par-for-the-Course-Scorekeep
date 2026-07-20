# Environment Variables

All environment variables must be set in **Render** (or your hosting provider's dashboard). Never hardcode secrets in source code.

---

## Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host/db` |
| `STRIPE_SECRET_KEY` | Stripe secret API key. Use `sk_test_...` in development, `sk_live_...` in production. | `sk_test_abc123` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from your Stripe webhook endpoint. Found in the Stripe Dashboard under Developers → Webhooks. | `whsec_abc123` |

---

## Optional (have safe defaults)

| Variable | Description | Default |
|---|---|---|
| `APP_BASE_URL` | Public base URL of the app. Used to build success/cancel redirect URLs. | Auto-detected from request host |
| `TOURNAMENT_PORTAL_BASE_URL` | Alternate base URL for portal-specific pages. | `https://portal.parforthecourse.com` |
| `SUCCESS_URL` | Override for Stripe success redirect. Supports `{slug}` and `{CHECKOUT_SESSION_ID}` templates. | `{origin}/events/{slug}/register/success?session_id={CHECKOUT_SESSION_ID}` |
| `CANCEL_URL` | Override for Stripe cancel redirect. Supports `{slug}` template. | `{origin}/events/{slug}/register/cancel` |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key for push notifications. | — |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key. | — |
| `VAPID_SUBJECT` | Web Push contact email. | `mailto:admin@parforthecourse.app` |

---

## Stripe Setup Checklist

### 1. Create Stripe Account
- Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
- Create or sign in to your account

### 2. Get Your API Keys
- Dashboard → Developers → API Keys
- Copy the **Secret key** (`sk_test_...` or `sk_live_...`)
- Set as `STRIPE_SECRET_KEY` in Render

### 3. Register a Webhook Endpoint
- Dashboard → Developers → Webhooks → Add endpoint
- Endpoint URL: `https://your-app.onrender.com/api/public/stripe/webhook`
- Select events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
- Copy the **Signing secret** (`whsec_...`)
- Set as `STRIPE_WEBHOOK_SECRET` in Render

### 4. (Optional) Create a Stripe Price for an Event
This is preferred over dynamic pricing — prices show up in Stripe analytics.

- Dashboard → Products → Add product
- Set a name (e.g. "Par for the Course Spring Classic 2026 – Entry")
- Set a one-time price (e.g. $35.00)
- Copy the **Price ID** (`price_...`)
- Paste into the TD Portal → Event Details → **Stripe Price ID** field

### 5. Test the Checkout Flow
Use these test card numbers:
- `4242 4242 4242 4242` — Visa (always succeeds)
- `4000 0000 0000 9995` — Visa (requires 3D Secure authentication)
- Any future expiry date (e.g. 12/30) and any 3-digit CVC

---

## How Pricing Works

The backend selects the pricing method in this order:

1. **Stripe Price ID** (set in TD Portal → Event Details): Uses a pre-created recurring/one-time price from your Stripe account. Preferred — appears in Stripe revenue analytics.
2. **Entry Fee** (set in TD Portal → Event Details → Entry Fee): Creates a one-off `price_data` inline with each checkout session. Works without any Stripe configuration beyond the secret key.

If neither is set, the registration button shows an error asking the TD to configure the entry fee.

---

## Security Notes

- `STRIPE_SECRET_KEY` is only ever accessed in `server/stripe.ts` on the backend
- The frontend never sees the secret key or any Stripe Price ID values
- Webhook signatures are verified with `STRIPE_WEBHOOK_SECRET` before any database writes
- Always use HTTPS in production (Render enforces this automatically)

