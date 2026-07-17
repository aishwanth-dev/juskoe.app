const KEY = process.argv[2];
const model = process.argv[3] || 'gemini-2.5-flash-lite';
const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: 'Reply with: hello world' }] }],
});
const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${KEY}`;
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 15000);
(async () => {
  try {
    const start = Date.now();
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
    const text = await res.text();
    clearTimeout(t);
    console.log(`${model} -> ${res.status} (${Date.now() - start}ms)`);
    console.log(text.replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) { clearTimeout(t); console.log('ERR', e.message); }
})();
