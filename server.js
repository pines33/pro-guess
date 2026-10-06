'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOM_IDLE_MS = 30 * 60 * 1000;   // rooms without activity are deleted after 30 min
const ROOM_EMPTY_MS = 10 * 60 * 1000;  // rooms where nobody is connected are deleted after 10 min
const HEARTBEAT_MS = 25 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const MAX_CHAT = 300;
const MAX_NAME = 20;

// ---------- Player data ----------
const { players: PLAYER_LIST } = require('./data/players.json');
const PLAYERS = new Map(PLAYER_LIST.map((p) => [p.id, p]));

function ageOf(p, now = new Date()) {
  const [y, m, d] = p.birth.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age--;
  return age;
}

/**
 * Wordle-style feedback for a guess against the secret player.
 * 'hit' = same, 'near' = close, 'miss' = wrong. dir = 'up'/'down' means the secret value is higher/lower.
 */
function compare(guess, secret) {
  const num = (g, s, nearRange) => {
    const diff = s - g;
    return {
      value: g,
      status: diff === 0 ? 'hit' : Math.abs(diff) <= nearRange ? 'near' : 'miss',
      dir: diff > 0 ? 'up' : diff < 0 ? 'down' : null,
    };
  };
  const eq = (a, b) => (a === b ? 'hit' : 'miss');
  return {
    country: { value: guess.country, status: eq(guess.country, secret.country) },
    region: { value: guess.region, status: eq(guess.region, secret.region) },
    team: { value: guess.team, status: eq(guess.team, secret.team) },
    role: {
      value: guess.role,
      status: guess.role === secret.role ? 'hit' : guess.role === 'Flex' || secret.role === 'Flex' ? 'near' : 'miss',
    },
    age: num(ageOf(guess), ageOf(secret), 2),
    titles: num(guess.titles.length, secret.titles.length, 1),
  };
}

// ---------- Rooms ----------
/**
 * room = {
 *   code, mode: 'duel'|'solo', phase: 'lobby'|'picking'|'playing'|'over', round, starter, turn, winner,
 *   players: [player|null, player|null], guesses: [{seat, player, correct, fb}], chat: [], lastActivity
 * }
 * player = { token, name, pick, ws, connected, rematch, disconnectedAt }
 * In solo mode the secret lives in room.soloSecret and the human is always seat 0.
 */
const rooms = new Map();

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

function cleanName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return n || 'Player';
}

function newPlayer(name) {
  return { token: crypto.randomBytes(16).toString('hex'), name: cleanName(name), pick: null, ws: null, connected: false, rematch: false };
}

function randomPlayerId() {
  return PLAYER_LIST[crypto.randomInt(PLAYER_LIST.length)].id;
}

function secretFor(room, seat) {
  // The player that `seat` is trying to guess
  return room.mode === 'solo' ? room.soloSecret : room.players[1 - seat].pick;
}

/** Per-player view – the secret being guessed is only included once the round is over. */
function viewFor(room, seat) {
  const me = room.players[seat];
  const op = room.mode === 'duel' ? room.players[1 - seat] : null;
  const over = room.phase === 'over';
  return {
    t: 'state',
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    round: room.round,
    seat,
    turn: room.turn,
    winner: room.winner,
    guesses: room.guesses,
    you: { name: me.name, pick: me.pick, rematch: me.rematch },
    opp: op
      ? { name: op.name, connected: op.connected, hasPicked: !!op.pick, rematch: op.rematch, pick: over ? op.pick : null }
      : null,
    answer: over ? secretFor(room, seat) : null,
  };
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcastState(room) {
  room.players.forEach((p, seat) => p && send(p.ws, viewFor(room, seat)));
}
function broadcast(room, msg) {
  room.players.forEach((p) => p && send(p.ws, msg));
}
function touch(room) {
  room.lastActivity = Date.now();
}

function attach(room, seat, ws) {
  const p = room.players[seat];
  if (p.ws && p.ws !== ws) {
    send(p.ws, { t: 'kicked', msg: 'This game was opened in another tab or device.' });
    p.ws.__room = null;
    p.ws.close();
  }
  p.ws = ws;
  p.connected = true;
  p.disconnectedAt = null;
  ws.__room = room.code;
  ws.__seat = seat;
  send(ws, { t: 'session', code: room.code, token: p.token, seat });
  send(ws, { t: 'chatLog', messages: room.chat });
}

function startRound(room) {
  room.round += 1;
  room.winner = null;
  room.guesses = [];
  room.players.forEach((p) => { if (p) { p.pick = null; p.rematch = false; } });
  if (room.mode === 'solo') {
    room.soloSecret = randomPlayerId();
    room.phase = 'playing';
    room.turn = 0;
  } else {
    room.phase = 'picking';
    room.turn = null;
  }
}

function newRoom(mode, name) {
  const room = {
    code: newCode(), mode, phase: 'lobby', round: 0, starter: crypto.randomInt(2), turn: null, winner: null,
    players: [newPlayer(name), null], guesses: [], chat: [], soloSecret: null, lastActivity: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

function pushChat(room, m) {
  m.ts = Date.now();
  room.chat.push(m);
  if (room.chat.length > 100) room.chat.shift();
  broadcast(room, { t: 'chat', message: m });
}

// ---------- Message handlers ----------
const handlers = {
  create(ws, msg) {
    const room = newRoom('duel', msg.name);
    attach(room, 0, ws);
    broadcastState(room);
  },

  solo(ws, msg) {
    const room = newRoom('solo', msg.name);
    attach(room, 0, ws);
    startRound(room);
    broadcastState(room);
  },

  join(ws, msg) {
    const room = rooms.get(String(msg.code || '').toUpperCase().trim());
    if (!room || room.mode !== 'duel') return send(ws, { t: 'error', code: 'noroom', msg: 'No room with that code.' });
    if (room.players[1]) return send(ws, { t: 'error', code: 'full', msg: 'That room is already full.' });
    room.players[1] = newPlayer(msg.name);
    attach(room, 1, ws);
    startRound(room);
    touch(room);
    broadcastState(room);
  },

  resume(ws, msg) {
    const room = rooms.get(String(msg.code || '').toUpperCase());
    const seat = room ? room.players.findIndex((p) => p && p.token === msg.token) : -1;
    if (seat < 0) return send(ws, { t: 'error', code: 'nosession', msg: 'That game no longer exists.' });
    attach(room, seat, ws);
    touch(room);
    broadcastState(room);
  },

  pick(ws, msg, room, seat) {
    if (room.mode !== 'duel' || room.phase !== 'picking') return;
    if (!PLAYERS.has(msg.player)) return send(ws, { t: 'error', msg: 'Unknown player.' });
    room.players[seat].pick = msg.player;
    if (room.players.every((p) => p && p.pick)) {
      room.phase = 'playing';
      room.turn = room.starter;
      room.starter = 1 - room.starter; // the other player starts next round
    }
    broadcastState(room);
  },

  guess(ws, msg, room, seat) {
    if (room.phase !== 'playing' || room.turn !== seat) return send(ws, { t: 'error', msg: "It's not your turn." });
    const guess = PLAYERS.get(msg.player);
    if (!guess) return send(ws, { t: 'error', msg: 'Unknown player.' });
    if (room.guesses.some((g) => g.seat === seat && g.player === guess.id)) {
      return send(ws, { t: 'error', msg: `You already guessed ${guess.name}.` });
    }
    const secret = PLAYERS.get(secretFor(room, seat));
    const correct = guess.id === secret.id;
    room.guesses.push({ seat, player: guess.id, correct, fb: compare(guess, secret) });
    if (correct) {
      room.phase = 'over';
      room.winner = seat;
      room.turn = null;
    } else if (room.mode === 'duel') {
      room.turn = 1 - seat;
    }
    if (room.mode === 'duel') pushChat(room, { kind: 'guess', seat, name: room.players[seat].name, player: guess.id, correct });
    broadcastState(room);
  },

  giveUp(ws, msg, room) {
    if (room.mode !== 'solo' || room.phase !== 'playing') return;
    room.phase = 'over';
    room.winner = null;
    room.turn = null;
    broadcastState(room);
  },

  chat(ws, msg, room, seat) {
    if (room.mode !== 'duel') return;
    const text = String(msg.text || '').trim().slice(0, MAX_CHAT);
    if (text) pushChat(room, { kind: 'text', seat, name: room.players[seat].name, text });
  },

  rematch(ws, msg, room, seat) {
    if (room.phase !== 'over') return;
    room.players[seat].rematch = true;
    if (room.players.every((p) => !p || p.rematch)) startRound(room);
    broadcastState(room);
  },

  leave(ws, msg, room, seat) {
    room.players[seat].ws = null;
    ws.__room = null;
    const other = room.mode === 'duel' ? room.players[1 - seat] : null;
    if (other) send(other.ws, { t: 'oppLeft' });
    rooms.delete(room.code);
  },
};

const ROOMLESS = new Set(['create', 'solo', 'join', 'resume']);

function onMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (!msg || typeof msg.t !== 'string' || !Object.hasOwn(handlers, msg.t)) return;
  if (ROOMLESS.has(msg.t)) {
    if (ws.__room) detach(ws);
    return handlers[msg.t](ws, msg);
  }
  const room = rooms.get(ws.__room);
  if (!room || room.players[ws.__seat]?.ws !== ws) {
    return send(ws, { t: 'error', code: 'nosession', msg: 'That game no longer exists.' });
  }
  touch(room);
  handlers[msg.t](ws, msg, room, ws.__seat);
}

function detach(ws) {
  const room = rooms.get(ws.__room);
  ws.__room = null;
  if (!room) return;
  const p = room.players[ws.__seat];
  if (p && p.ws === ws) {
    p.ws = null;
    p.connected = false;
    p.disconnectedAt = Date.now();
    broadcastState(room);
  }
}

// ---------- HTTP + WebSocket ----------
const app = express();
app.disable('x-powered-by');
app.get('/healthz', (req, res) => res.send('ok'));
// Public player data (no secrets – the secret is just an id kept on the server)
app.get('/players.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'players.json')));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => onMessage(ws, data.toString()));
  ws.on('close', () => detach(ws));
  ws.on('error', () => {});
});

// Keeps connections alive (Render/Railway proxies drop idle sockets) and cleans up old rooms.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, room] of rooms) {
    const players = room.players.filter(Boolean);
    const allGone = players.every((p) => !p.connected && now - (p.disconnectedAt || 0) > ROOM_EMPTY_MS);
    if (now - room.lastActivity > ROOM_IDLE_MS || allGone) {
      players.forEach((p) => p.ws && send(p.ws, { t: 'error', code: 'nosession', msg: 'The game was closed due to inactivity.' }));
      rooms.delete(code);
    }
  }
}, HEARTBEAT_MS).unref();

server.listen(PORT, () => {
  console.log(`Valorant Guess running on http://localhost:${PORT} (${PLAYERS.size} players)`);
});

module.exports = { server, rooms, compare, ageOf };
