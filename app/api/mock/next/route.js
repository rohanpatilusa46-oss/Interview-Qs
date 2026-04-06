import { NextResponse } from 'next/server';
import { getNextInterviewStep } from '../../../../lib/mockInterviewEngine';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const sessionId = String(body?.sessionId || '').trim();
  const action = String(body?.action || 'repeat').trim();
  const sessionSnapshot = body?.sessionSnapshot;

  if (!sessionId) {
    return NextResponse.json({ error: { message: 'sessionId is required.' } }, { status: 400 });
  }

  try {
    const result = await getNextInterviewStep({ sessionId, action, sessionSnapshot });
    return NextResponse.json(result);
  } catch (error) {
    const message = error?.message || 'Unable to get next interview step.';
    const status = /not found|expired/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: { message } }, { status });
  }
}
