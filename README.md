# ML Interview Prep — Next.js App

An interactive AI/ML interview prep app with concept browsing, guided explanations, bookmarks, history, quizzes, and comparisons.

## Quick Start

1. Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EVAL_MODEL=gpt-4o-mini
OPENAI_STT_MODEL=whisper-1

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret-key

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

2. Create the Supabase table:

```bash
# In Supabase SQL editor, run:
# supabase/schema.sql
```

3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Features
- 13 domains with a searchable concept browser
- Topic explanations powered by OpenAI via a secure Next.js API route
- Per-user cloud history/bookmarks/quizzes when signed in
- Bookmarks for quick revisits
- Quiz mode for active recall
- Compare mode for side-by-side concept review
- Voice-based subsection-scoped mock interviews (difficulty, duration, mode)
- Real-time speech flow: AI asks verbally, user answers via mic, AI evaluates and follows up
- Modern dark UI with responsive layout

## Project Structure
- `app/page.jsx` — main interface and client-side study flows
- `app/api/chat/route.js` — server-side OpenAI proxy
- `app/api/library/route.js` — signed-in user library sync API
- `app/api/mock/start/route.js` — start mock interview session
- `app/api/mock/answer/route.js` — evaluate spoken/text answer and continue interview
- `app/api/mock/next/route.js` — repeat/skip to next interview prompt
- `app/api/mock/transcribe/route.js` — Whisper fallback transcription for recorded audio
- `components/MockInterviewModal.jsx` — voice interview UI and transcript
- `lib/mockInterviewEngine.js` — interview state machine/session logic
- `lib/mockPrompts.js` — question/evaluation/follow-up prompts
- `lib/llmRouter.js` — Ollama/OpenAI routing helpers
- `lib/data.js` — ML interview concept taxonomy
- `lib/supabaseAdmin.js` — server-only Supabase client
- `middleware.js` — Clerk middleware
- `supabase/schema.sql` — required table schema
- `app/globals.css` — UI styling

## Notes
- The browser never sees your OpenAI key.
- Signed-out users use local `localStorage`.
- Signed-in users sync bookmarks/history/quiz cache to Supabase by Clerk user ID.
- Mock interview question generation attempts Ollama first, then falls back to OpenAI.
- Mock interview evaluation/follow-ups use OpenAI for quality scoring and feedback.
- The legacy HTML entry points were replaced by a Next.js app.

## Deploying on Vercel
- Add all env vars from `.env.example` in Vercel project settings.
- Connect GitHub repo and deploy.
- Ensure `supabase/schema.sql` has been executed in your Supabase project.
