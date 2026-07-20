# Bug Fix Summary - July 20, 2026

## Issues Fixed

### 1. ✅ Stripe Checkout Error: "Failed to start checkout"

**Problem**: The Stripe API call was using an incorrect parameter structure that caused checkout session creation to fail.

**Root Cause**: The code was using `line_items[0][price_data][product]` with `STRIPE_PRODUCT_ID`, but the Stripe API expects either:
- A predefined `price` ID, OR
- Inline product data using `product_data` with product metadata

**Fix Applied**: Changed lines 962-963 in `server/routes.ts`:
```typescript
// ❌ OLD (Incorrect):
body.set("line_items[0][price_data][product]", STRIPE_PRODUCT_ID);

// ✅ NEW (Correct):
body.set("line_items[0][price_data][product_data][name]", `${event.name} - Tournament Entry`);
body.set("line_items[0][price_data][product_data][type]", "service");
```

**Additional Improvement**: Enhanced error logging (lines 979, 985-986) to provide better debugging information when checkout fails.

---

### 2. ✅ Google Maps Embed Error: "Place info couldn't load"

**Problem**: The Google Maps embed URL format `&output=embed` was either deprecated or not working reliably.

**Root Cause**: The URL format being used was inconsistent with how Google Maps handles iframe embeds. The original code used:
```
https://www.google.com/maps?q=Address&output=embed
```

This format is not consistently supported across all browsers and Google may have deprecated it.

**Fix Applied**: Changed line 28 in `client/src/components/GoogleMapsEmbed.tsx`:
```typescript
// ✅ UPDATED:
return `https://maps.google.com/maps?q=${encodeURIComponent(value)}&output=embed`;
```

Changed the host from `www.google.com` to `maps.google.com` which is the proper embed subdomain.

**Note**: The CSP (Content Security Policy) in `index.html` already permits this:
```html
frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com
```

---

## Environment Variables to Verify

Make sure these are properly configured in your deployment environment:

```env
# Required for Stripe Checkout
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_...

# Required for redirect URLs
SUCCESS_URL=https://yourdomain.com/events/{slug}/register/success?session_id={CHECKOUT_SESSION_ID}
CANCEL_URL=https://yourdomain.com/events/{slug}/register/cancel
```

---

## Testing the Fixes

### For Stripe Checkout:
1. Navigate to a tournament registration page
2. Click "Register" or "Try Again"
3. Should redirect to Stripe Checkout page (not show "Failed to start checkout")
4. Check browser console for detailed error messages if still failing

### For Google Maps:
1. View a tournament detail page with venue information
2. Scroll to the "Venue" section
3. Maps should display properly (not show "Place info couldn't load")
4. If maps still don't load, try refreshing or clearing browser cache

---

## Potential Remaining Issues to Monitor

1. **Stripe API Rate Limiting**: If you make many checkout requests quickly, Stripe may rate limit you
2. **Invalid Product ID**: If you created custom products in Stripe, remove `STRIPE_PRODUCT_ID` from unused code
3. **Google Maps Quota**: If using Google Maps extensively, ensure you have sufficient quota
4. **CORS Issues**: If requests are blocked, check server-side CORS configuration

---

## Files Modified

- `server/routes.ts` (lines 962-963, 979, 985-986)
- `client/src/components/GoogleMapsEmbed.tsx` (line 28)

## Next Steps

1. **Deploy** these changes to your server
2. **Test Stripe Checkout** with a test card (if in test mode)
3. **Test Google Maps Embed** on various tournament pages
4. **Monitor logs** in your server for any new error messages
5. If issues persist, check the browser console (F12 > Console tab) for client-side errors

