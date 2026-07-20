# Troubleshooting Guide

## Stripe Checkout Still Showing "Failed to start checkout"

### Step 1: Check Environment Variables
```powershell
# Verify STRIPE_SECRET_KEY is set
echo $env:STRIPE_SECRET_KEY  # Should print sk_test_... or sk_live_...
```

**Common Issues:**
- ❌ Variable not set
- ❌ Invalid format (should start with `sk_test_` or `sk_live_`)
- ❌ Typo in variable name

### Step 2: Check Browser Console (F12)
- Open DevTools → Console tab
- Try registering for a tournament
- Look for error message in console
- Check the actual error text (e.g., "invalid parameter", etc.)

### Step 3: Check Server Logs
Look for error patterns:
```
Error creating checkout session: invalid_request_error | [message]
```

**Common Stripe Errors:**
- `invalid_price_data`: Product data structure is wrong
- `resource_missing`: Tournament not found or entry fee not configured
- `authentication_error`: STRIPE_SECRET_KEY is invalid
- `rate_limit_error`: Too many requests to Stripe API

### Step 4: Verify Event Configuration
1. Check that the tournament has `entryFee > 0`
2. Ensure the tournament `slug` is correct and matches database

---

## Google Maps Still Showing "Place info couldn't load"

### Step 1: Check Page Source
- Right-click on venue section → Inspect
- Find the `<iframe>` tag
- Check the `src` attribute - should start with:
  ```
  https://maps.google.com/maps?q=...&output=embed
  ```

### Step 2: Test URL Directly
Copy the iframe `src` URL and paste directly in browser:
- ✅ Should show Google Maps interface
- ❌ If blank/error, the URL format is wrong

### Step 3: Check CSP Header
- Open DevTools → Network tab
- Refresh page
- Click on the first request (usually HTML)
- Check Response Headers for `Content-Security-Policy`
- Should include: `frame-src 'self' https://maps.google.com`

### Step 4: Test with Different Addresses
Try these test addresses to verify Google Maps is working:
- "Times Square, New York"
- "1600 Pennsylvania Avenue Washington DC"
- "Space Needle Seattle Washington"

If maps load with test addresses but not your venue, the issue might be:
- Venue address is incomplete or malformed
- Address is outside mapped regions
- Special characters in address need encoding

---

## Stripe Test Mode (Recommended for Testing)

Use these test credentials:

**Test Card Numbers:**
- `4242 4242 4242 4242` - Visa (succeeds)
- `4000 0000 0000 9995` - Visa (requires authentication)
- `5555 5555 5555 4444` - Mastercard

**Test Expiry:** Any future date (e.g., 12/25)
**Test CVC:** Any 3 digits (e.g., 123)

---

## Quick Verification Checklist

- [ ] STRIPE_SECRET_KEY is set and valid
- [ ] SUCCESS_URL and CANCEL_URL are configured
- [ ] Tournament entry fee is > 0
- [ ] Tournament address or mapUrl is set
- [ ] Server has been restarted after env var changes
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] No typos in environment variable names
- [ ] Event is not marked as "closed" or "completed"

---

## Still Having Issues?

1. **Check logs**: Look for patterns in server console
2. **Enable debug mode**: Add more `console.error()` calls
3. **Test in isolation**: Create a simple test endpoint
4. **Check Stripe Dashboard**: https://dashboard.stripe.com/logs
   - Verify API calls are reaching Stripe
   - Check for webhook errors
   - Review failed charges

---

## Contact Information for Further Support

If issues persist after verifying above:
1. Share the exact error message from console/logs
2. Provide environment variable names (not values!)
3. Check if this occurs in test or production environment

