# gemini_test.py - checks that your Gemini API key and model work.
# Run from the backend folder (venv active):
#   python gemini_test.py
#   python gemini_test.py gemini-3.5-flash-lite gemini-3.8-flash
import json
import os
import sys
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()

KEY = os.getenv("GEMINI_API_KEY", "").strip()
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
TIMEOUT = 60

if not KEY or KEY.lower().startswith("your-"):
    sys.exit("GEMINI_API_KEY is missing or still a placeholder in backend/.env")


def test(model: str) -> None:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": "Reply with the single word: OK"}]}]
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": KEY},
        method="POST",
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = time.time() - start
            try:
                answer = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError):
                answer = "(no text in response)"
            print(f"[OK]   {model:<28} HTTP {resp.status}  {elapsed:5.1f}s  -> {answer}")
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        try:
            msg = json.loads(e.read().decode("utf-8", "replace")).get("error", {}).get("message", "")
        except ValueError:
            msg = ""
        print(f"[FAIL] {model:<28} HTTP {e.code}  {elapsed:5.1f}s  -> {msg[:300]}")
    except Exception as e:  # timeout, DNS, proxy, etc.
        elapsed = time.time() - start
        print(f"[FAIL] {model:<28} {type(e).__name__}  {elapsed:5.1f}s  -> {e}")


if __name__ == "__main__":
    models = sys.argv[1:] or [DEFAULT_MODEL]
    print(f"Testing {len(models)} model(s)...\n")
    for m in models:
        test(m)
    print("\nPut a model that shows [OK] and a low time into GEMINI_MODEL in backend/.env, then restart.")
