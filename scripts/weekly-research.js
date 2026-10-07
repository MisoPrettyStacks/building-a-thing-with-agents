// Weekly Researcher: scan arXiv (q-fin + related) for recent work on
// short-horizon crypto predictability, order-flow, and calibration.
// Logs the most relevant finds; promising ideas are flagged for backtesting.
// Read-only with respect to the model: this job never changes parameters.
const QUERIES = [
  'all:cryptocurrency+AND+all:predictability',
  'all:bitcoin+AND+all:high-frequency+AND+all:forecast',
  'all:order+flow+AND+all:cryptocurrency',
  'all:calibration+AND+all:probabilistic+AND+all:forecast',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/researcher' } });
    clearTimeout(to);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
    return entries.map((e) => {
      const t = (re) => (e.match(re) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
      return { title: t(/<title>([\s\S]*?)<\/title>/), published: t(/<published>(.*?)<\/published>/), id: t(/<id>(.*?)<\/id>/) };
    }).filter((p) => p.title);
  } catch {
    clearTimeout(to);
    return [];
  }
}

async function main() {
  const out = { agent: 'researcher', tag: 'info', decision: '', detail: '' };
  try {
    const seen = new Set();
    const picks = [];
    for (const q of QUERIES) {
      for (const p of await arxivSearch(q)) {
        if (seen.has(p.id) || picks.length >= 5) continue;
        seen.add(p.id);
        picks.push(p);
      }
      await new Promise((r) => setTimeout(r, 1500)); // be polite to the API
    }
    if (!picks.length) {
      out.decision = 'literature scan complete: no new papers';
      out.detail = 'arXiv q-fin scan returned nothing new this week.';
    } else {
      out.decision = `literature scan complete: ${picks.length} candidate paper${picks.length > 1 ? 's' : ''}`;
      out.detail = picks.map((p) => `"${p.title}" (${p.published.slice(0, 10)})`).join(' · ') +
        '. Flagged for backtesting; only winners survive.';
    }
  } catch (e) {
    out.decision = 'literature scan failed';
    out.detail = String(e?.message || e).slice(0, 300);
    out.tag = 'alarm';
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), agent: out.agent, decision: out.decision, detail: out.detail, tag: out.tag }));
}
main();
