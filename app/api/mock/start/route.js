import { NextResponse } from 'next/server';
import { startInterview } from '../../../../lib/mockInterviewEngine';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const subsection = String(body?.subsection || '').trim();
  if (!subsection) {
    return NextResponse.json({ error: { message: 'Subsection is required.' } }, { status: 400 });
  }

  try {
    const result = await startInterview({
      subsection,
      topic: body?.topic,
      difficulty: body?.difficulty || 'Medium',
      durationMinutes: Number(body?.durationMinutes) || 10,
      mode: body?.mode || 'Mixed',
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: { message: error?.message || 'Unable to start interview.' } }, { status: 500 });
  }
}
