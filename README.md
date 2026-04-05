# ML Interview Prep — Localhost App

An interactive AI/ML concept explorer with GPT-4o powered explanations.

## Quick Start

### Option 1: Python server (recommended)
```bash
python server.py
```
Opens automatically at http://localhost:3001

### Option 2: Just open the file
Double-click `index.html` in your file manager, or:
```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```
> Note: The app now sends requests through the local Python server, so use `python server.py` for the full experience.

## Usage

1. **Add your OpenAI API key** to `.env` as `OPENAI_API_KEY=...`
2. **Run the local server** with `python server.py`
3. **Click any concept tag** to get a GPT-4o explanation in the right panel
4. **Ask follow-up questions** in the chat input
5. **Use suggested questions** (quick chips above the input) for common angles
6. **Search** any concept using the search bar at the top

## Features
- 13 domains, 300+ concepts
- Click any tag → instant GPT-4o explanation
- Full chat history per topic
- Markdown rendering (code blocks, headers, bold, lists)
- Suggested follow-up questions per topic
- Search/filter across all concepts
- Dark theme, minimal design

## Environment

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

- The browser never sees your API key
- Requests are proxied through `server.py`
- If the key is missing, the server will start but chat requests will return a helpful error

## Requirements
- Python 3.x (for the server — optional)
- A modern browser (Chrome, Firefox, Safari, Edge)
- An OpenAI API key with access to `gpt-4o`
