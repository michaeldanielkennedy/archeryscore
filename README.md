# 🎯 Archery Scoreboard

A live scoreboard for UK (Archery GB) rounds, themed per venue:

| Venue | Theme |
|---|---|
| 1st Hillsborough | Green + red |
| Lisburn Cathedral | Red |
| Dagger Road | Green with a little yellow |

Log in, pick a venue and date, choose a round (Portsmouth, WA 18m, Worcester, York, Hereford, St George, Windsor, National, WA 720 and more) and tap in each arrow. The **Leaderboard** tab shows everyone at the same venue on the same date, updating automatically.

It's a static site (no build step), so it runs on GitHub Pages.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)`.
3. Your site appears at `https://<you>.github.io/<repo>/`.

## Sharing scores between people (important)

GitHub Pages is static, so scores need somewhere to live. With `firebaseUrl` empty in `config.js` the app runs in **demo mode**: scores stay in one browser. To share live:

1. Create a free project at <https://console.firebase.google.com> → **Build → Realtime Database → Create database**.
2. Copy the database URL into `config.js` (`firebaseUrl`).
3. In the database **Rules** tab, paste:

```json
{
  "rules": {
    "users":    { "$u": { ".read": true, ".write": "!data.exists()" } },
    "sessions": { ".read": true, ".write": true }
  }
}
```

> Note: this is a lightweight club setup. Accounts are name + PIN (PIN is SHA-256 hashed in the browser), and anyone with the URL can read scores. It is not suitable for sensitive data.

## Scoring

- **Imperial 5-zone** (York, Hereford, St George, Windsor, National…): 9 / 7 / 5 / 3 / 1, six arrows an end.
- **Metric 10-zone** (Portsmouth, WA 18m, WA 720…): X/10 down to 1.
- **Worcester**: 5 to 1.
- Golds = 9s and above (Worcester: 5s). Ties are broken by X count, then golds.

Rounds live in `rounds.js`; add your own there.
