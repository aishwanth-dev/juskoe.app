// Test Vertex AI with service account — manual JWT → OAuth token → generateContent
import crypto from 'node:crypto';
import fs from 'node:fs';

const sa = JSON.parse(fs.readFileSync('vertex-key.json', 'utf8'));
const PROJECT = sa.project_id;
const MODEL = process.argv[2] || 'gemini-2.5-flash-lite';
const REGION = process.argv[3] || 'us-central1';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function callVertex(token, prompt, systemPrompt) {
  const host = REGION === 'global' ? 'aiplatform.googleapis.com' : `${REGION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
  };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - start, text };
}

(async () => {
  try {
    console.log(`Project: ${PROJECT} | Model: ${MODEL} | Region: ${REGION}`);
    const tokenStart = Date.now();
    const token = await getAccessToken();
    console.log(`✓ OAuth token obtained (${Date.now() - tokenStart}ms)`);

    // Simulate the real Juskoe AI-mode pipeline
    const systemPrompt = `System-level text engine. You are a content generator, NOT a chatbot. Convert speech into paste-ready content. Output the FINAL RESULT only. No intros. Plain text only.`;
    const userPrompt = `write a short professional email to my manager asking for leave on friday for a doctor appointment`;

    const r = await callVertex(token, userPrompt, systemPrompt);
    console.log(`\n=== generateContent: ${r.status} (${r.ms}ms) ===`);
    if (r.status === 200) {
      const json = JSON.parse(r.text);
      const out = json.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
      const usage = json.usageMetadata || {};
      console.log('OUTPUT:\n' + out);
      console.log(`\nTokens: in=${usage.promptTokenCount} out=${usage.candidatesTokenCount} total=${usage.totalTokenCount}`);
      console.log('Traffic type:', usage.trafficType || 'n/a');
    } else {
      console.log(r.text.replace(/\s+/g, ' ').slice(0, 500));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
})();
