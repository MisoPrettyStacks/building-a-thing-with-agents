// Weekly Retrainer: deeper champion-vs-challenger search than the live 5-minute
// loop performs. Fetches recent Coinbase bars, loads the live champion config
// from the data branch, and runs searchChallenger with a wider candidate pool.
// It never auto-adopts: a passing challenger is logged as a candidate for the
// live Accuracy agent to verify and adopt through its own rollback-guarded path.
import { fetchBars } from '../lib/data.js';
import { searchChallenger } from '../lib/agent.js';
import { DEFAULT_CONFIG } from '../lib/engine.js';

const REPO = process.env.REPO || 'MisoPrettyStacks/building-a-thing-with-agents';
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/data/summary.json`;

async function main() {
  const out = { agent: 'retrainer', tag: 'info', decision: '', detail: '' };
  try {
    // 1. Champion config from the live data branch (fall back to defaults)
    let champion = { ...DEFAULT_CONFIG, features: DEFAULT_CONFIG.features.slice() };
    let cfgSource = 'DEFAULT_CONFIG';
    try {
      const s = await (await fetch(DATA_URL, { cache: 'no-store' })).json();
      if (s?.config?.champion) { champion = s.config.champion; cfgSource = 'live summary.json v' + (champion.version ?? '?'); }
    } catch { /* offline or no data yet: use defaults */ }

    // 2. Recent bars (deep search needs history; ~17 days of 5-min bars)
    const bars = await fetchBars(5000);
    if (bars.length < 4000) throw new Error(`only ${bars.length} bars fetched, need 4000+`);

    // 3. Deep challenger search (K=40, wider than the live loop)
    const seed = Math.floor(Date.now() / 604800000); // weekly seed: deterministic within a week
    const res = searchChallenger({ bars, champion, seed, K: 40, testBars: 2016 });

    if (res.decision === 'adopt') {
      const b = res.evidence.best;
      out.decision = 'challenger passed deep search';
      out.detail = `Weekly deep search (K=40, ${bars.length} bars, champion from ${cfgSource}). ` +
        `Candidate "${b.change}" beat champion by ${b.delta.toExponential(2)} Brier (DM p=${b.dmP.toFixed(4)}). Flagged for the live Accuracy agent to verify and adopt.`;
      out.tag = 'adopt';
    } else if (res.decision === 'keep') {
      out.decision = 'deep search complete: champion holds';
      out.detail = `Weekly deep search (K=40, ${bars.length} bars, champion from ${cfgSource}). Best candidate failed: ${res.reason}. Champion retained.`;
    } else { // skip
      out.decision = 'deep search skipped';
      out.detail = `Not enough history (${res.reason}).`;
    }
  } catch (e) {
    out.decision = 'deep search failed';
    out.detail = String(e?.message || e).slice(0, 300);
    out.tag = 'alarm';
  }
  const rec = { ts: new Date().toISOString(), agent: out.agent, decision: out.decision, detail: out.detail, tag: out.tag };
  console.log(JSON.stringify(rec));
}
main();
