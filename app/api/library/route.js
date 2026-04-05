import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePayload(payload) {
  return {
    bookmarks: Array.isArray(payload?.bookmarks) ? payload.bookmarks : [],
    conversations: isPlainObject(payload?.conversations) ? payload.conversations : {},
    quizCache: isPlainObject(payload?.quizCache) ? payload.quizCache : {},
  };
}

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: { message: 'Supabase environment is not configured.' } },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from('user_library')
    .select('bookmarks, conversations, quiz_cache')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  return NextResponse.json({
    bookmarks: Array.isArray(data?.bookmarks) ? data.bookmarks : [],
    conversations: isPlainObject(data?.conversations) ? data.conversations : {},
    quizCache: isPlainObject(data?.quiz_cache) ? data.quiz_cache : {},
  });
}

export async function POST(request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: { message: 'Supabase environment is not configured.' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const normalized = normalizePayload(body);

  const { error } = await supabase.from('user_library').upsert(
    {
      user_id: userId,
      bookmarks: normalized.bookmarks,
      conversations: normalized.conversations,
      quiz_cache: normalized.quizCache,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
