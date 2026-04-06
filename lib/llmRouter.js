function extractJson(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function callOpenAIChat({
  messages,
  temperature = 0.4,
  maxTokens = 700,
  model = process.env.OPENAI_MODEL || 'gpt-4o',
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const raw = await response.text();
  const payload = extractJson(raw);

  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI error (${response.status}).`);
  }

  return payload?.choices?.[0]?.message?.content?.trim() || '';
}

export async function callOllamaChat({
  prompt,
  model = process.env.OLLAMA_MODEL || 'llama3.1:8b',
  baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  temperature = 0.3,
}) {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature },
    }),
  });

  const raw = await response.text();
  const payload = extractJson(raw);

  if (!response.ok) {
    throw new Error(payload?.error || `Ollama error (${response.status}).`);
  }

  return String(payload?.response || '').trim();
}

export function parseJsonFromLLM(raw, fallback = {}) {
  const parsed = extractJson(raw);
  return parsed && typeof parsed === 'object' ? parsed : fallback;
}
