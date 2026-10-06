'use strict';
// Bygger data/players.json från Liquipedias API (CC BY-SA 3.0) + tools/curated.js.
// Kör: npm run build-data   (följer Liquipedias API-regler: 1 anrop / 2 s, egen User-Agent, gzip)
const fs = require('fs');
const path = require('path');
const { PLAYERS, TITLES, COUNTRY_OVERRIDE } = require('./curated');

const API = 'https://liquipedia.net/valorant/api.php';
const UA = 'ValorantGuessDataBuilder/1.0 (https://github.com/pines33/Landlocked)';
let last = 0;

async function api(params) {
  const wait = last + 2200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const COUNTRIES = {
  'united states': 'US', canada: 'CA', morocco: 'MA', brazil: 'BR', argentina: 'AR', chile: 'CL',
  'united kingdom': 'GB', finland: 'FI', russia: 'RU', turkey: 'TR', sweden: 'SE', netherlands: 'NL',
  poland: 'PL', ukraine: 'UA', latvia: 'LV', belgium: 'BE', lithuania: 'LT', indonesia: 'ID',
  singapore: 'SG', malaysia: 'MY', philippines: 'PH', 'south korea': 'KR', japan: 'JP', china: 'CN', taiwan: 'TW',
};

const field = (text, key) => {
  const m = text.match(new RegExp('^\\|\\s*' + key + '\\s*=([^\\n]*)', 'm'));
  return m ? m[1].replace(/<!--.*?-->/g, '').replace(/<ref.*$/, '').trim() : '';
};

async function fetchPages(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: titles.slice(i, i + 50).join('|') });
    const back = {};
    for (const n of j.query.normalized || []) back[n.to] = n.from;
    for (const r of j.query.redirects || []) back[r.to] = back[r.from] || r.from;
    for (const p of j.query.pages) out[back[p.title] || p.title] = p.missing ? null : { title: p.title, text: p.revisions[0].slots.main.content };
  }
  return out;
}

async function fetchImages(files) {
  const out = {};
  const list = [...new Set(Object.values(files))];
  for (let i = 0; i < list.length; i += 50) {
    const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '240', titles: list.slice(i, i + 50).join('|') });
    const back = {};
    for (const n of j.query.normalized || []) back[n.to] = n.from;
    for (const p of j.query.pages) {
      const ii = p.imageinfo?.[0];
      out[back[p.title] || p.title] = ii ? { src: ii.thumburl || ii.url, page: ii.descriptionurl } : null;
    }
  }
  return Object.fromEntries(Object.entries(files).map(([k, f]) => [k, out[f]]));
}

(async () => {
  const pages = await fetchPages(PLAYERS.map((p) => p[0]));
  const files = {};
  for (const [page] of PLAYERS) {
    const img = pages[page] && field(pages[page].text, 'image');
    if (img) files[page] = 'File:' + img;
  }
  const images = await fetchImages(files);

  const titlesBy = {};
  for (const [event, roster] of TITLES) for (const p of roster) (titlesBy[p] ||= []).push(event);

  const players = [];
  for (const [page, team, region, role] of PLAYERS) {
    const p = pages[page];
    if (!p) { console.warn('Saknas på Liquipedia:', page); continue; }
    const t = p.text;
    const nick = field(t, 'id') || page;
    const countryName = field(t, 'country').toLowerCase();
    const country = COUNTRY_OVERRIDE[nick] || COUNTRIES[countryName];
    const birth = field(t, 'birth_date');
    if (!country || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(birth)) { console.warn('Ofullständig data, hoppar över:', page, countryName, birth); continue; }
    const [y, m, d] = birth.split('-').map(Number);
    const real = field(t, 'romanized_name') || field(t, 'name');
    players.push({
      id: nick.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name: nick,
      realName: /^[\p{Script=Latin}\s'.-]+$/u.test(real) ? real : '',
      country,
      birth: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      team,
      region,
      role,
      titles: titlesBy[nick] || [],
      image: images[page] || null,
      source: 'https://liquipedia.net/valorant/' + encodeURIComponent(p.title.replace(/ /g, '_')),
    });
  }
  const ids = new Set();
  for (const p of players) { if (ids.has(p.id)) throw new Error('Dubblett-id ' + p.id); ids.add(p.id); }
  const out = path.join(__dirname, '..', 'data', 'players.json');
  fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), players }, null, 1) + '\n');
  console.log(`Skrev ${players.length} spelare till ${path.relative(process.cwd(), out)}`);
})().catch((e) => { console.error(e); process.exit(1); });
