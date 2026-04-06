import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: { message: 'Missing OPENAI_API_KEY.' } }, { status: 500 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid multipart form data.' } }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!audio) {
    return NextResponse.json({ error: { message: 'audio file is required.' } }, { status: 400 });
  }

  try {
    const payload = new FormData();
    payload.append('file', audio, audio.name || 'recording.webm');
    payload.append('model', process.env.OPENAI_STT_MODEL || 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      return NextResponse.json({ error: { message: data?.error?.message || `Transcription failed (${response.status}).` } }, { status: response.status });
    }

    return NextResponse.json({ text: data?.text || '' });
  } catch (error) {
    return NextResponse.json({ error: { message: error?.message || 'Unable to transcribe audio.' } }, { status: 500 });
  }
}
