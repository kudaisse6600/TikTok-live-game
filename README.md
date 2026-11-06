# Kingdom Wars LIVE — Android broadcast + hosted TikTok connector

This is a working **integration project**, not a guarantee that TikTok allows the account to receive every event. TikTok-Live-Connector is an unofficial third-party integration and may break or be restricted.

## What runs where
- **Android phone:** TikTok Mobile Gaming / Screen Share LIVE and Chrome browser displaying the hosted game.
- **Hosted Node.js server:** Receives TikTok LIVE events and sends them to the game via WebSocket. A phone-only setup still requires an online server.

## Deploy on Render (using a GitHub repository)
1. Upload all the project files to a **private** GitHub repository. Keep `public/` and `server.js` in the same project root.
2. On https://dashboard.render.com/ create a **Web Service** connected to that repository.
3. Choose **Node**, build command `npm install`, start command `npm start`.
4. Add environment variable `TIKTOK_USERNAME` = your TikTok handle **without @**. No TikTok password is required.
5. Deploy, then open the Render HTTPS URL on Android Chrome.
6. Start your TikTok LIVE using **Mobile Gaming / Screen Share** if your account supports it; switch to Chrome showing the game.
7. A status label shows whether the event connector is connected. Comment `RED` or `BLUE` from a second account to test.

## Events
- Viewer joins (member): spawn fighter **when the event is delivered**. Not all viewer joins are exposed reliably.
- Chat `RED` or `BLUE`: join the team; `JOIN`/`!JOIN`: join balanced team.
- Follow: free shield.
- Gift: upgrades fighter based on reported coin value. Actual gift metadata and repeat handling may vary with TikTok changes.
- Battles and rounds are automatic. Set duration in the browser UI.

## Caveats
- Render free web services may sleep and may not be suitable for uninterrupted livestreaming. Use an always-on plan/service for reliable events.
- The game currently runs separately in each browser; keep one active broadcaster tab. A reload resets its match state.
- TikTok Android screen-share availability is account/region dependent. If not available, phone-only screen broadcasting cannot be assumed possible.
- For security, avoid publishing private stream keys, passwords or session cookies. No login credentials are requested here.
- Use TikTok features and integrations only where permitted by their terms.
- If TikTok ends a LIVE or restricts connection, automatic event collection cannot be guaranteed.
