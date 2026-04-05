#!/usr/bin/env python3
"""
ML Interview Prep - Local Server
Run: python server.py
Then open: http://localhost:3001
"""
import json
import http.server
import os
import socket
import socketserver
import threading
import urllib.error
import urllib.request
import webbrowser

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(DIRECTORY, ".env")


def load_dotenv(path):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv(ENV_PATH)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"


def find_available_port(start_port):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("", port))
            except OSError:
                port += 1
                continue
            return port


PORT = find_available_port(int(os.environ.get("PORT", 3001)))


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404, "Not Found")
            return

        if not OPENAI_API_KEY:
            self._send_json(
                500,
                {"error": "Missing OPENAI_API_KEY. Add it to your .env file and restart the server."},
            )
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body."})
            return

        system_prompt = payload.get("systemPrompt", "")
        messages = payload.get("messages", [])
        model = payload.get("model", OPENAI_MODEL) or OPENAI_MODEL

        request_body = json.dumps(
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    *messages,
                ],
                "temperature": 0.7,
                "max_tokens": 1200,
            }
        ).encode("utf-8")

        request = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                response_data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed_error = json.loads(error_body)
            except json.JSONDecodeError:
                parsed_error = {"error": {"message": error_body or f"HTTP {exc.code}"}}
            self._send_json(exc.code, parsed_error)
            return
        except urllib.error.URLError as exc:
            self._send_json(502, {"error": f"Unable to reach OpenAI: {exc.reason}"})
            return

        message = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        self._send_json(200, {"content": message})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"  {self.address_string()} → {format % args}")

def open_browser():
    import time
    time.sleep(0.8)
    webbrowser.open(f"http://localhost:{PORT}")

print("━" * 50)
print("  ML Interview Prep")
print("━" * 50)
print(f"  Server: http://localhost:{PORT}")
print(f"  Directory: {DIRECTORY}")
print(f"  OpenAI key: {'configured' if OPENAI_API_KEY else 'missing (.env)'}")
print("  Opening browser automatically...")
print("  Press Ctrl+C to stop")
print("━" * 50)

threading.Thread(target=open_browser, daemon=True).start()

with ReusableTCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
