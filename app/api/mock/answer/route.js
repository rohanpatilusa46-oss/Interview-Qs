import { NextResponse } from 'next/server';
import { submitInterviewAnswer } from '../../../../lib/mockInterviewEngine';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const sessionId = String(body?.sessionId || '').trim();
  const answerText = String(body?.answerText || '').trim();
  const sessionSnapshot = body?.sessionSnapshot;

  if (!sessionId) {
    return NextResponse.json({ error: { message: 'sessionId is required.' } }, { status: 400 });
  }

  if (!answerText) {
    return NextResponse.json({ error: { message: 'answerText is required.' } }, { status: 400 });
  }

  try {
    const result = await submitInterviewAnswer({ sessionId, answerText, sessionSnapshot });
    return NextResponse.json(result);
  } catch (error) {
    const message = error?.message || 'Unable to process answer.';
    const status = /not found|expired/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: { message } }, { status });
  }
}
