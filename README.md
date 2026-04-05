# ML Interview Prep — Next.js App

An interactive AI/ML interview prep app with concept browsing, guided explanations, bookmarks, history, quizzes, and comparisons.

## Quick Start

1. Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Features
- 13 domains with a searchable concept browser
- Topic explanations powered by OpenAI via a secure Next.js API route
- Persistent chat history per concept
- Bookmarks for quick revisits
- Quiz mode for active recall
- Compare mode for side-by-side concept review
- Modern dark UI with responsive layout

## Project Structure
- `app/page.jsx` — main interface and client-side study flows
- `app/api/chat/route.js` — server-side OpenAI proxy
- `lib/data.js` — ML interview concept taxonomy
- `app/globals.css` — UI styling

## Notes
- The browser never sees your OpenAI key.
- Bookmarks, history, and quizzes are stored in `localStorage`.
- The legacy HTML entry points were replaced by a Next.js app.
