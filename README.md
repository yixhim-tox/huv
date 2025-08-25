# 2.00 Odds Builder (Client-Only Demo)

This is a minimal website that pulls **real upcoming games** from **The Odds API** and suggests
**2–3 leg accumulators** whose **total decimal odds are ≤ 2.00**. It uses the *Match Winner* market
(`h2h`) and picks the favorite in different games, then searches for 2–3 leg combos under 2.00.

> ⚠️ For production, you should **not expose your API key** in client code. Use a small server or proxy.
This demo follows your request to include the key directly.

## Quick Start
Just open `index.html` in a modern browser with internet access.

- Choose a league and odds region.
- Click **Refresh Games** to fetch real upcoming markets.
- Click **Find 2.00 Slip** to build top 2–3 combos totaling ≤ 2.00.
- If you get *No qualifying slips*, try a different league/region or come back later.

## Notes
- Markets: uses `h2h` (match winner) from the first bookmaker returned.
- Timezone: times display in your local timezone.
- Real games only: the app filters out events that already started.
- Safety: Please bet responsibly. This app provides suggestions, not guarantees.
