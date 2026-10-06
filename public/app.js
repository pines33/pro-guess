'use strict';

/* ================= Helpers ================= */
const $ = (sel) => document.querySelector(sel);
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const flagOf = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const countryName = (cc) => { try { return regionNames.of(cc) || cc; } catch { return cc; } };
const isMobile = () => matchMedia('(max-width: 900px)').matches;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del(key) { try { localStorage.removeItem(key); } catch {} },
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ================= State ================= */
let PLAYERS = [];
let BY_ID = new Map();

const S = {
  ws: null, retry: 0, kicked: false, queue: [],
  session: store.get('pg_session'), // { code, token }
  seat: null,
  state: null,
  chat: [],
  candidate: null,     // pro selected while picking a secret
  tab: 'opp',
  unread: 0,
  seenGuesses: 0,      // to animate only new cards
  resultShownRound: null,
  prevTurn: null,
  oppGuessNote: null,
  hideSecret: false,
};

/* ================= Connection ================= */
function connect() {
  clearTimeout(connect.timer);
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  setConn('');
  ws.onopen = () => {
    S.retry = 0;
    setConn('on');
    hideBanner();
    if (S.session) ws.send(JSON.stringify({ t: 'resume', ...S.session }));
    while (S.queue.length) ws.send(JSON.stringify(S.queue.shift()));
  };
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    onMessage(msg);
  };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    setConn('off');
    if (S.kicked) return;
    if (S.session) showBanner('Connection lost – reconnecting…');
    connect.timer = setTimeout(connect, Math.min(10000, 500 * 2 ** S.retry++));
  };
}

function send(msg) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) S.ws.send(JSON.stringify(msg));
  else S.queue.push(msg);
}

document.addEventListener('visibilitychange', () => {
  // Phones often drop sockets in the background – reconnect as soon as the tab is visible again.
  if (document.visibilityState === 'visible' && !S.kicked && (!S.ws || S.ws.readyState === WebSocket.CLOSED)) connect();
});

function setConn(cls) {
  const c = $('#conn');
  c.className = 'conn ' + cls;
  c.title = cls === 'on' ? 'Connected' : cls === 'off' ? 'Disconnected' : 'Connecting…';
}
function showBanner(text, kind = '') {
  const b = $('#banner');
  b.textContent = text;
  b.className = 'banner ' + kind;
  b.hidden = false;
}
function hideBanner() { $('#banner').hidden = true; }

let toastTimer;
function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ================= Server messages ================= */
function onMessage(msg) {
  switch (msg.t) {
    case 'session':
      S.session = { code: msg.code, token: msg.token };
      S.seat = msg.seat;
      store.set('pg_session', S.session);
      break;

    case 'state': {
      const prev = S.state;
      S.state = msg;
      S.seat = msg.seat;
      if (msg.mode === 'duel') history.replaceState(null, '', `?room=${msg.code}`);
      else if (location.search) history.replaceState(null, '', location.pathname);
      if (!prev || prev.round !== msg.round) { S.candidate = null; S.seenGuesses = 0; }
      if (msg.mode === 'duel' && msg.phase === 'playing' && msg.turn === msg.seat && S.prevTurn !== msg.seat && prev?.phase === 'playing') {
        toast(S.oppGuessNote ? `${S.oppGuessNote} Your turn!` : 'Your turn!', S.oppGuessNote ? 3600 : 2600);
        navigator.vibrate?.(60);
      }
      S.prevTurn = msg.turn;
      S.oppGuessNote = null;
      render();
      break;
    }

    case 'chatLog':
      S.chat = msg.messages || [];
      renderChat();
      break;

    case 'chat':
      S.chat.push(msg.message);
      appendChat(msg.message);
      onLiveChat(msg.message);
      break;

    case 'error':
      if (msg.code === 'nosession') { clearSession(); showStart(msg.msg); }
      else if (!$('#screen-start').hidden) $('#startError').textContent = msg.msg;
      else toast(msg.msg);
      break;

    case 'kicked':
      S.kicked = true;
      showBanner(msg.msg + ' Reload the page to continue here.');
      setConn('off');
      break;

    case 'oppLeft':
      clearSession();
      showStart('Your opponent left the game.');
      break;
  }
}

function onLiveChat(m) {
  const me = m.seat === S.seat;
  if (m.kind === 'guess') {
    if (!me && !m.correct) S.oppGuessNote = `${m.name} guessed ${BY_ID.get(m.player)?.name} – wrong.`;
  } else if (!me && S.tab !== 'chat') {
    S.unread++;
    renderUnread();
  }
}

function clearSession() {
  S.session = null;
  S.state = null;
  S.chat = [];
  S.candidate = null;
  store.del('pg_session');
  history.replaceState(null, '', location.pathname);
  closeResult();
}

/* ================= Screens ================= */
function showScreen(name) {
  for (const s of ['start', 'lobby', 'board']) $('#screen-' + s).hidden = s !== name;
}
function showStart(error = '') {
  showScreen('start');
  $('#roomChip').hidden = true;
  $('#startError').textContent = error;
}
const shareUrl = () => `${location.origin}/?room=${S.state.code}`;

function render() {
  const st = S.state;
  if (!st) return;
  hideBanner();
  const chip = $('#roomChip');
  chip.hidden = st.mode !== 'duel';
  chip.textContent = st.code;

  if (st.phase === 'lobby') {
    showScreen('lobby');
    $('#lobbyCode').textContent = st.code;
    $('#shareLink').value = shareUrl();
    $('#shareBtn').hidden = !navigator.share;
    return;
  }
  showScreen('board');
  renderStatus();
  renderSearchArea();
  renderGuesses();
  renderResult();
}

const myTurn = () => S.state.phase === 'playing' && S.state.turn === S.state.seat;
const myGuesses = () => S.state.guesses.filter((g) => g.seat === S.state.seat);
const oppGuesses = () => S.state.guesses.filter((g) => g.seat !== S.state.seat);

function renderStatus() {
  const st = S.state, opp = st.opp;
  let text = '', sub = '';
  if (st.mode === 'solo') {
    const n = myGuesses().length;
    text = st.phase === 'over' ? (st.winner === st.seat ? `Found in ${n} ${n === 1 ? 'guess' : 'guesses'}!` : 'Better luck next time') : 'Guess the pro';
    sub = st.phase === 'over' ? 'Play again for a new random pro.' : n ? `${n} ${n === 1 ? 'guess' : 'guesses'} so far.` : 'Start with anyone – every guess gives you clues.';
  } else if (st.phase === 'picking') {
    text = st.you.pick ? `Waiting for ${opp.name}…` : 'Pick your secret pro';
    sub = st.you.pick ? 'You can still change your pick until both are locked in.'
      : opp.hasPicked ? `${opp.name} has locked in.` : `${opp.name} is picking too…`;
  } else if (st.phase === 'playing') {
    text = myTurn() ? 'Your turn – make a guess' : `${opp.name} is guessing…`;
    sub = myTurn() ? `Find ${opp.name}'s secret pro.` : 'Their clues compare with your secret pro.';
  } else {
    text = st.winner === st.seat ? 'You win! 🏆' : `${opp.name} wins`;
    sub = opp.rematch && !st.you.rematch ? `${opp.name} wants a rematch!` : 'Round over.';
  }
  if (opp && !opp.connected && st.phase !== 'over') sub = `⚠️ ${opp.name} disconnected – waiting for them to come back.`;
  const t = $('#statusText');
  t.textContent = text;
  t.classList.toggle('myturn', st.mode === 'duel' && myTurn());
  $('#statusSub').textContent = sub;

  // The player's own secret (duel only)
  const chipEl = $('#mySecret');
  const pick = st.you.pick && BY_ID.get(st.you.pick);
  chipEl.hidden = !pick;
  if (pick) {
    chipEl.innerHTML = '';
    chipEl.append(avatar(pick), el('span', 'nm', `Your pro: ${pick.name}`));
    chipEl.title = S.hideSecret ? 'Show your pro' : 'Hide your pro (e.g. when streaming)';
    chipEl.classList.toggle('hidden-name', S.hideSecret);
  }
}

$('#mySecret').onclick = () => { S.hideSecret = !S.hideSecret; renderStatus(); };

function renderSearchArea() {
  const st = S.state;
  const picking = st.phase === 'picking';
  const canGuess = st.phase === 'playing' && (st.mode === 'solo' || myTurn());
  const input = $('#search');
  input.disabled = !(picking || canGuess);
  input.placeholder = picking ? 'Search for your secret pro…'
    : canGuess ? 'Type a pro, team or country…'
    : st.phase === 'over' ? 'Round over' : 'Wait for your turn…';
  $('#randomBtn').hidden = !picking;
  $('#giveUpBtn').hidden = !(st.mode === 'solo' && st.phase === 'playing');
  $('#showResultBtn').hidden = st.phase !== 'over';
  if (input.disabled) closeSuggest();
  $('.legend').hidden = picking;
  $('#duelPanel').hidden = st.mode !== 'duel';
  $('#oppCount').textContent = oppGuesses().length ? `(${oppGuesses().length})` : '';

  const prev = $('#pickPreview');
  const cand = picking && S.candidate && BY_ID.get(S.candidate);
  prev.hidden = !cand;
  prev.innerHTML = '';
  if (cand) {
    prev.append(playerCard(cand, null));
    const b = el('button', 'btn primary', st.you.pick === cand.id ? 'Locked in ✓' : `Lock in ${cand.name}`);
    b.disabled = st.you.pick === cand.id;
    b.onclick = () => { send({ t: 'pick', player: cand.id }); };
    prev.append(b);
  }
}

/* ================= Cards ================= */
function avatar(p) {
  const initials = p.name.slice(0, 2).toUpperCase();
  if (!p.image) return el('span', 'avatar', initials);
  const img = new Image();
  img.className = 'avatar';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = p.image.src;
  img.onerror = () => img.replaceWith(el('span', 'avatar', initials));
  return img;
}

function ageNow(p) {
  const [y, m, d] = p.birth.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

/** A player card. fb = server feedback (null → neutral tiles, e.g. for the pick preview / reveal). */
function playerCard(p, fb, { num, correct, animate } = {}) {
  const card = el('article', 'pcard' + (correct ? ' correct' : ''));
  const head = el('div', 'pcard-head');
  const names = el('div');
  names.append(el('div', 'pcard-name', p.name), el('div', 'pcard-real', p.realName || ''));
  head.append(avatar(p), names);
  if (num) head.append(el('span', 'pcard-num', `#${num}`));
  card.append(head);

  const tiles = el('div', 'tiles');
  const defs = [
    ['country', 'Nationality', () => { const s = el('span'); s.append(el('span', 'flag', flagOf(p.country) + ' '), countryName(p.country)); return s; }],
    ['region', 'Region', () => p.region],
    ['team', 'Team', () => p.team],
    ['role', 'Role', () => p.role],
    ['age', 'Age', () => String(fb ? fb.age.value : ageNow(p))],
    ['titles', 'Titles', () => String(p.titles.length)],
  ];
  defs.forEach(([key, label, value], i) => {
    const f = fb && fb[key];
    const tile = el('div', 'tile' + (f ? ' ' + f.status : '') + (animate ? ' flip' : ''));
    if (animate) tile.style.animationDelay = `${i * 90}ms`;
    const v = el('div', 'val');
    const content = value();
    if (typeof content === 'string') v.textContent = content; else v.append(content);
    if (f?.dir) v.append(el('span', 'arrow', f.dir === 'up' ? '↑' : '↓'));
    tile.append(el('div', 'lbl', label), v);
    if (key === 'titles' && p.titles.length) tile.title = p.titles.join('\n');
    if (f?.dir) tile.title = (tile.title ? tile.title + '\n\n' : '') + `The secret pro's ${label.toLowerCase()} is ${f.dir === 'up' ? 'higher' : 'lower'}.`;
    tiles.append(tile);
  });
  card.append(tiles);
  return card;
}

function renderGuesses() {
  const st = S.state;
  const mine = myGuesses();
  const box = $('#myGuesses');
  box.innerHTML = '';
  $('#myCount').textContent = mine.length ? `${mine.length} ${mine.length === 1 ? 'guess' : 'guesses'}` : '';
  if (!mine.length) {
    box.append(el('div', 'empty', st.phase === 'picking' ? 'Your guesses will be pinned here once the game starts.' : 'No guesses yet. Search for a pro to start.'));
  }
  const all = st.guesses;
  mine.slice().reverse().forEach((g, i) => {
    const idx = mine.length - i;
    const isNew = all.indexOf(g) >= S.seenGuesses;
    box.append(playerCard(BY_ID.get(g.player), g.fb, { num: idx, correct: g.correct, animate: isNew }));
  });

  const ob = $('#oppGuesses');
  ob.innerHTML = '';
  const theirs = oppGuesses();
  if (!theirs.length) ob.append(el('div', 'empty', st.mode === 'duel' && st.opp ? `${st.opp.name} hasn't guessed yet.` : ''));
  theirs.slice().reverse().forEach((g, i) => {
    const isNew = all.indexOf(g) >= S.seenGuesses;
    ob.append(playerCard(BY_ID.get(g.player), g.fb, { num: theirs.length - i, correct: g.correct, animate: isNew }));
  });
  S.seenGuesses = all.length;
}

/* ================= Search / autocomplete ================= */
const input = $('#search');
const list = $('#suggest');
let matches = [];
let active = -1;

function search(q) {
  q = fold(q.trim());
  if (!q) return [];
  const scored = [];
  for (const p of PLAYERS) {
    const name = fold(p.name), real = fold(p.realName), team = fold(p.team), country = fold(countryName(p.country));
    let score = -1;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (real.split(' ').some((w) => w.startsWith(q))) score = 40;
    else if (team.includes(q)) score = 30;
    else if (country.startsWith(q)) score = 20;
    if (score >= 0) scored.push([score, p]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).slice(0, 30).map((s) => s[1]);
}

function renderSuggest() {
  list.innerHTML = '';
  const guessed = new Set(S.state ? myGuesses().map((g) => g.player) : []);
  if (!matches.length) {
    if (input.value.trim()) list.append(el('li', 's-empty', 'No pro found.'));
    else return closeSuggest();
  }
  matches.forEach((p, i) => {
    const li = el('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === active));
    const done = guessed.has(p.id);
    if (done) li.classList.add('done');
    const txt = el('div');
    txt.append(el('div', 's-name', p.name), el('div', 's-sub', `${flagOf(p.country)} ${p.team}${done ? ' · already guessed' : ''}`));
    li.append(avatar(p), txt);
    li.onmousedown = (e) => e.preventDefault(); // keep focus in the input
    li.onclick = () => choose(p);
    list.append(li);
  });
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  list.children[active]?.scrollIntoView({ block: 'nearest' });
}

function closeSuggest() {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  active = -1;
}

function choose(p) {
  const st = S.state;
  if (!st) return;
  if (st.phase === 'picking') {
    S.candidate = p.id;
    renderSearchArea();
  } else if (st.phase === 'playing') {
    if (myGuesses().some((g) => g.player === p.id)) return toast(`You already guessed ${p.name}.`);
    send({ t: 'guess', player: p.id });
  }
  input.value = '';
  matches = [];
  closeSuggest();
  if (!isMobile()) input.focus(); else input.blur();
}

input.addEventListener('input', () => { matches = search(input.value); active = matches.length ? 0 : -1; renderSuggest(); });
input.addEventListener('focus', () => { if (input.value.trim()) renderSuggest(); });
input.addEventListener('blur', () => setTimeout(closeSuggest, 120));
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!matches.length) return;
    e.preventDefault();
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    renderSuggest();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (matches[active]) choose(matches[active]);
  } else if (e.key === 'Escape') {
    closeSuggest();
  }
});

$('#randomBtn').onclick = () => { S.candidate = PLAYERS[Math.floor(Math.random() * PLAYERS.length)].id; renderSearchArea(); };
$('#giveUpBtn').onclick = () => { if (confirm('Give up and reveal the pro?')) send({ t: 'giveUp' }); };

/* ================= Tabs + chat ================= */
for (const tab of document.querySelectorAll('.tab')) {
  tab.onclick = () => {
    S.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + S.tab));
    if (S.tab === 'chat') { S.unread = 0; renderUnread(); scrollChat(); }
  };
}
function renderUnread() {
  const u = $('#unread');
  u.hidden = !S.unread;
  u.textContent = S.unread;
}

function chatNode(m) {
  if (m.kind === 'guess') {
    const p = BY_ID.get(m.player);
    return el('div', 'sys' + (m.correct ? ' win' : ''), `${m.seat === S.seat ? 'You' : m.name} guessed ${p ? p.name : '?'} – ${m.correct ? 'correct! 🏆' : 'wrong'}`);
  }
  const div = el('div', 'msg' + (m.seat === S.seat ? ' me' : ''));
  if (m.seat !== S.seat) div.append(el('span', 'who', m.name));
  div.append(document.createTextNode(m.text));
  return div;
}
function renderChat() {
  const log = $('#chatLog');
  log.innerHTML = '';
  if (!S.chat.length) log.append(el('span', 'chat-empty', 'Talk trash here – or hop on a voice call.'));
  for (const m of S.chat) log.append(chatNode(m));
  scrollChat();
}
function appendChat(m) {
  const log = $('#chatLog');
  log.querySelector('.chat-empty')?.remove();
  log.append(chatNode(m));
  scrollChat();
}
function scrollChat() { const log = $('#chatLog'); log.scrollTop = log.scrollHeight; }

$('#chatForm').onsubmit = (e) => {
  e.preventDefault();
  const i = $('#chatInput');
  const text = i.value.trim();
  if (!text) return;
  send({ t: 'chat', text });
  i.value = '';
};

/* ================= Result ================= */
const dlg = $('#resultDlg');

function renderResult() {
  const st = S.state;
  if (st.phase !== 'over') { closeResult(); return; }
  const won = st.winner === st.seat;
  const n = myGuesses().length;
  $('#resultEmoji').textContent = won ? '🏆' : st.mode === 'solo' ? '🏳️' : '💀';
  $('#resultTitle').textContent = won ? 'You got it!' : st.mode === 'solo' ? 'You gave up' : `${st.opp.name} got it first`;
  $('#resultLead').textContent = won ? `${n} ${n === 1 ? 'guess' : 'guesses'}.` : '';

  const cards = $('#resultCards');
  cards.innerHTML = '';
  const add = (label, id) => {
    const p = BY_ID.get(id);
    if (!p) return;
    const wrap = el('div');
    wrap.append(el('div', 'who', label), playerCard(p, null));
    cards.append(wrap);
  };
  add(st.mode === 'solo' ? 'The secret pro' : `${st.opp.name}'s pro`, st.answer);
  if (st.mode === 'duel') add('Your pro', st.you.pick);

  let sub = '';
  if (st.mode === 'duel') {
    if (st.you.rematch && !st.opp.rematch) sub = `Waiting for ${st.opp.name} to accept the rematch…`;
    else if (st.opp.rematch && !st.you.rematch) sub = `${st.opp.name} wants a rematch!`;
  }
  $('#resultSub').textContent = sub;
  $('#rematchBtn').disabled = st.you.rematch;
  $('#rematchBtn').textContent = st.you.rematch ? 'Waiting…' : st.mode === 'solo' ? 'New pro' : 'Rematch';

  if (S.resultShownRound !== st.round) {
    S.resultShownRound = st.round;
    // Let the last card flip before the dialog opens
    setTimeout(openResult, won ? 900 : 200);
  }
}
function openResult() { if (S.state?.phase === 'over' && !dlg.open) dlg.showModal(); }
function closeResult() { if (dlg.open) dlg.close(); }

$('#rematchBtn').onclick = () => send({ t: 'rematch' });
$('#closeResult').onclick = closeResult;
$('#showResultBtn').onclick = openResult;

/* ================= Start / lobby ================= */
const nameInput = $('#nameInput');
nameInput.value = store.get('pg_name') || '';
nameInput.addEventListener('input', () => store.set('pg_name', nameInput.value.trim()));

function startSession(msg) {
  $('#startError').textContent = '';
  S.kicked = false;
  S.session = null;
  S.state = null;
  S.chat = [];
  send(msg);
}
$('#createBtn').onclick = () => startSession({ t: 'create', name: nameInput.value });
$('#soloBtn').onclick = () => startSession({ t: 'solo', name: nameInput.value });
$('#joinForm').onsubmit = (e) => {
  e.preventDefault();
  const code = $('#codeInput').value.trim().toUpperCase();
  if (code.length !== 4) { $('#startError').textContent = 'Room codes are 4 characters.'; return; }
  startSession({ t: 'join', code, name: nameInput.value });
};
$('#codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

async function copyLink() {
  try { await navigator.clipboard.writeText(shareUrl()); toast('Link copied'); }
  catch { $('#shareLink').select(); toast('Select and copy the link'); }
}
$('#copyBtn').onclick = copyLink;
$('#roomChip').onclick = copyLink;
$('#shareBtn').onclick = () => navigator.share({ title: 'Pro Guess', text: `Guess my Valorant pro! Room ${S.state.code}`, url: shareUrl() }).catch(() => {});

for (const b of document.querySelectorAll('.leaveBtn')) {
  b.onclick = () => {
    if (S.state?.mode === 'duel' && !confirm('Leave the game? It ends for both of you.')) return;
    send({ t: 'leave' });
    clearSession();
    showStart();
  };
}

/* ================= Boot ================= */
async function init() {
  const data = await (await fetch('/players.json')).json();
  PLAYERS = data.players;
  BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

  const urlCode = new URLSearchParams(location.search).get('room')?.toUpperCase();
  if (urlCode && S.session?.code !== urlCode) { S.session = null; store.del('pg_session'); }
  if (S.session) {
    showBanner('Reconnecting to your game…', 'info');
  } else {
    showStart();
    if (urlCode) {
      $('#codeInput').value = urlCode;
      (nameInput.value ? $('#codeInput') : nameInput).focus();
    }
  }
  connect();
}

init().catch((err) => {
  console.error(err);
  showBanner('Could not load the game. Try reloading the page.');
});
