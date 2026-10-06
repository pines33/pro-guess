# Pro Guess – guess the Valorant pro

A Wordle-style guessing game about Valorant esports pros. Play **solo** against a random pro, or **1v1 online**: each player picks a secret pro and you take turns guessing the other one's player.

Every guess is pinned to the side of the screen with the player's photo, name and six clues:

| Clue | Green | Yellow |
|---|---|---|
| Nationality | same country | – |
| Region | same VCT region (Americas, EMEA, Pacific, China) | – |
| Team | same team | – |
| Role | same role | one of the two players is a Flex player |
| Age | same age | within 2 years (↑/↓ shows if the secret pro is older/younger) |
| Titles | same number of international titles | within 1 (↑/↓) |

**Titles** are international trophies: Masters and Champions events from 2021 through Masters London 2026. **Team** is the team a player is best known for.

## Run locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. To test two players on one computer, open the second player at http://127.0.0.1:3000 or in a private window so the tabs don't share a saved session.

## How it works

- **Server** (`server.js`): Node.js + Express + WebSockets (`ws`). Rooms live in memory and are deleted after 30 minutes without activity, or 10 minutes after both players have disconnected.
- **Frontend** (`public/`): plain HTML/CSS/JS, no build step. Mobile friendly, with light and dark mode that follow the system setting.
- **Cheat-proof:** the secret pro never leaves the server until the round is over. The server checks every guess, works out the colours and arrows, and enforces whose turn it is.
- **Reconnects:** each player gets a secret token stored in `localStorage`. If the connection drops, the page is reloaded or the phone is locked, the client rejoins the same room automatically.

## Player data

`data/players.json` contains 106 pros. It is generated from [Liquipedia](https://liquipedia.net/valorant/) (nationality, birth date, photo) together with hand-curated values in `tools/curated.js` (best-known team, region, main role and title-winning rosters). Roles are based on each player's most-played agents.

To add a player or fix a value, edit `tools/curated.js` and run:

```bash
npm run build-data
```

The script follows Liquipedia's API rules: one request every 2 seconds, a custom User-Agent and gzip.

Photos are loaded directly from Liquipedia. Liquipedia text content is licensed under CC BY-SA 3.0. This is a fan project and is not affiliated with or endorsed by Riot Games.

## Deploy for free on Render

1. Push this folder to a GitHub repository, with `package.json` at the **root** of the repo.
2. On [render.com](https://render.com) choose **New → Web Service** and select the repo.
3. Use these settings: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**.
4. When the log says *Your service is live*, share the `https://….onrender.com` URL.

Free Render services sleep after about 15 minutes without traffic. The first visit afterwards takes 30–60 seconds, and any running games are lost because rooms only live in memory.

**Railway** also works: choose *New Project → Deploy from GitHub repo*, then *Settings → Networking → Generate Domain*.

## Files

```
server.js              Game server: rooms, turns, guess feedback, chat, cleanup
data/players.json      Generated player data
tools/curated.js       Hand-curated teams, regions, roles and title rosters
tools/build-players.js Rebuilds players.json from Liquipedia
public/                index.html, app.js, style.css
render.yaml            Render blueprint
```
