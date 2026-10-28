# Steam account connection

Steam OpenID 2.0 verifies a Steam identity for an existing signed-in AfScripts account. It does not replace email/password sign-in or prove ownership. Connect and Disconnect Steam are in Settings → Account & Sync.

## Configuration and deployment

- The `steam_openid_account_linking` migration is already applied to Lovable Cloud. It creates owner-readable/deletable `steam_accounts` and service-only login-attempt/nonce tables. Authenticated users cannot insert or change Steam identity fields.
- Publish the app to make `/steam/connect`, `/api/public/steam/callback`, and `/steam/complete` available on the production HTTPS domain. No Steam API key, Steam app registration, auth-provider switch, or additional secret is needed.
- This TanStack Start project uses server functions and server routes, not Supabase Edge Functions. The public callback verifies the Steam OpenID assertion directly against Steam before privileged account writes.
- Connect opens a same-origin window to set an HttpOnly SameSite=Lax cookie outside the editor iframe. Allow popups if blocked. Start and finish login on the same HTTPS domain; switching domains loses cookie binding.
- Sign in to AfScripts first, then connect Steam. Disconnect removes only the AfScripts association, not Steam's own browser session. Signing out of AfScripts does not disconnect the linked account.
- The static Windows installer cannot run these server endpoints. Account linking is web-only in this version. Native Steam install detection, search, and filesystem workflows are unchanged.

## Profile details without a key

OpenID provides only SteamID. Name/avatar are fetched separately from Steam's deprecated public profile XML endpoint, with identity, XML and image-host validation. This endpoint is best-effort: privacy, Steam outages or retirement can make details unavailable. The app shows that state explicitly while preserving the verified identity and profile URL. Refresh profile retries the public lookup. Guaranteed profile metadata would require a supported Steam Web API integration later.

## Security and verification

Every callback checks the exact provider, claimed identity, signed fields, return URL, timestamp, Steam `check_authentication`, one-time hashed-cookie-bound login attempt, and persistent response-nonce uniqueness. A SteamID can be linked to only one AfScripts account. No access token is passed in a URL; login tokens are random and their hashes alone are stored.

Unit tests cover assertion tampering, signature verification response, expiry, duplicate fields, XML identity mismatch and untrusted avatars. Real Steam login completion requires the user to sign in at Steam; automated checks must not claim that an invalid/cancelled callback proves successful authentication. No owned games or achievements are requested.