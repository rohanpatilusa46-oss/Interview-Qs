import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey) {
    return NextResponse.json(
      { error: { message: 'Missing OPENAI_API_KEY in .env.' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const { systemPrompt = '', messages = [], temperature = 0.7, max_tokens = 1200, response_format } = body;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature,
        max_tokens,
        ...(response_format ? { response_format } : {}),
      }),
    });

    const raw = await response.text();
    let payload;

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {
        error: {
          message: response.ok
            ? 'Upstream returned an invalid response.'
            : `Upstream error (${response.status}).`,
        },
      };
    }

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json({
      content: payload.choices?.[0]?.message?.content ?? '',
      usage: payload.usage ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error?.message || 'Unable to reach OpenAI.' } },
      { status: 502 }
    );
  }
}
