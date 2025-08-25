// Simple client-only site that calls The Odds API directly.
// Note: For production, proxy your API key server-side. You asked to include it in-code.

// === CONFIG ===
const API_KEY = "f34045a05288619387f2975857a72d33"; // supplied by user
const BASE = "https://api.the-odds-api.com/v4";

const els = {
  sport: document.getElementById("sport"),
  region: document.getElementById("region"),
  maxLegs: document.getElementById("maxLegs"),
  btnFind: document.getElementById("btnFind"),
  btnRefresh: document.getElementById("btnRefresh"),
  status: document.getElementById("status"),
  tips: document.getElementById("tips"),
};

function setStatus(msg, kind="info") {
  els.status.textContent = msg;
  if (kind === "warn") els.status.style.color = "var(--warn)";
  else els.status.style.color = "var(--muted)";
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { hour12: false });
  } catch {
    return iso;
  }
}

function product(arr) { return arr.reduce((a,b) => a * b, 1); }

// === UPDATED ===
// Build 2–3 leg slips close to 2.00 (never empty)
function buildTwoOddsCombos(picks, maxLegs) {
  // Wider range so more games qualify
  const usable = picks.filter(p => p.price >= 1.10 && p.price <= 2.00);
  const best = [];

  // Generate all 2- and 3-leg combos
  for (let i = 0; i < usable.length; i++) {
    for (let j = i+1; j < usable.length; j++) {
      const combo2 = [usable[i], usable[j]];
      const total2 = product(combo2.map(x => x.price));
      if (total2 <= 2.20) {
        best.push({ legs: combo2, total: total2 });
      }
      if (maxLegs >= 3) {
        for (let k = j+1; k < usable.length; k++) {
          const combo3 = [usable[i], usable[j], usable[k]];
          const total3 = product(combo3.map(x => x.price));
          if (total3 <= 2.20) {
            best.push({ legs: combo3, total: total3 });
          }
        }
      }
    }
  }

  // ✅ if no combos found, fallback: just take 2–3 singles
  if (!best.length && usable.length) {
    const fallback = usable.slice(0, Math.min(3, usable.length));
    return [{
      legs: fallback,
      total: product(fallback.map(x => x.price)),
    }];
  }

  // Sort by closest to 2.00
  best.sort((a,b) => Math.abs(2 - a.total) - Math.abs(2 - b.total));

  return best.slice(0, 3); // return up to 3 slips
}

// Fetch odds for given sport + region
async function fetchGames(sportKey, region) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: region || "eu",
    markets: "h2h",
    oddsFormat: "decimal",
    dateFormat: "iso",
  });
  const url = `${BASE}/sports/${sportKey}/odds?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return json;
}

function extractPicksFromGames(games) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const picks = [];

  for (const g of games) {
    if (!g?.commence_time) continue;
    const start = new Date(g.commence_time);
    const gameDay = g.commence_time.split("T")[0];
    if (start < now) continue;
    if (gameDay !== today) continue;

    const book = (g.bookmakers || [])[0];
    if (!book) continue;
    const mkt = (book.markets || []).find(m => m.key === "h2h");
    if (!mkt) continue;

    const fav = (mkt.outcomes || []).slice().sort((a,b) => a.price - b.price)[0];
    if (!fav || typeof fav.price !== "number") continue;

    picks.push({
      id: `${g.id}:${fav.name}`,
      event: `${g.home_team} vs ${g.away_team}`,
      pick: fav.name,
      price: fav.price,
      startISO: g.commence_time,
      bookmaker: book.title || book.key,
    });
  }
  const seen = new Set();
  const unique = [];
  for (const p of picks) {
    const eid = p.id.split(":")[0];
    if (seen.has(eid)) continue;
    seen.add(eid);
    unique.push(p);
  }
  return unique;
}

function renderCombos(combos) {
  els.tips.innerHTML = "";
  if (!combos.length) {
    els.tips.innerHTML = `<div class="tip"><h3>No qualifying slips</h3><p>Try another region or click Refresh Games.</p></div>`;
    return;
  }
  for (const c of combos) {
    const legsHtml = c.legs.map(l => `
      <div class="row">
        <div>
          <div><strong>${l.pick}</strong> — <span class="badge">Match Winner</span></div>
          <div>${l.event}</div>
        </div>
        <div>@ ${l.price.toFixed(2)}</div>
      </div>
      <div class="row" style="color:var(--muted)">Kickoff: ${fmtTime(l.startISO)} &nbsp; | &nbsp; Source: ${l.bookmaker}</div>
    `).join("");

    const card = document.createElement("div");
    card.className = "tip";
    card.innerHTML = `
      <h3>${c.legs.length} picks — Total <span class="total">${c.total.toFixed(2)}</span></h3>
      ${legsHtml}
    `;
    els.tips.appendChild(card);
  }
}

let cached = [];

// === UPDATED ===
// Now fetches *all sports* instead of just one sport
async function refresh() {
  const region = els.region.value;
  setStatus("Fetching all sports & odds…");
  try {
    // First get list of sports
    const sportsRes = await fetch(`${BASE}/sports?apiKey=${API_KEY}`);
    const sports = await sportsRes.json();

    let allPicks = [];
    for (const sp of sports) {
      try {
        const games = await fetchGames(sp.key, region);
        const picks = extractPicksFromGames(games);
        allPicks = allPicks.concat(picks);
      } catch (err) {
        console.warn("Skip sport", sp.key, err.message);
      }
    }

    cached = allPicks;
    setStatus(`Loaded ${cached.length} candidate picks across all sports. Build the slip!`);
  } catch (e) {
    console.error(e);
    setStatus(e.message, "warn");
  }
}

async function build() {
  if (!cached.length) {
    await refresh();
  }
  const maxLegs = parseInt(els.maxLegs.value, 10);
  const combos = buildTwoOddsCombos(cached, maxLegs);
  renderCombos(combos);
  if (combos.length) {
    setStatus(`Found ${combos.length} slip(s) near 2.00 odds.`);
  } else {
    setStatus("No slips around 2.00 — try again.", "warn");
  }
}

els.btnRefresh.addEventListener("click", refresh);
els.btnFind.addEventListener("click", build);

// Initial load
refresh();
