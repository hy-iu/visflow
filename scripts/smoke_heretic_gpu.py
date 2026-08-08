import base64
import json
import time
import urllib.request

p = r"datasets/nsfw-labeled/nsfw/9769ae0a_zzgnt5071490451001.jpg"
b64 = base64.b64encode(open(p, "rb").read()).decode()
body = {
    "model": "heretic",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
                {"type": "text", "text": "Are any underwear or panties visible in this image? Answer Yes or No in one word."},
            ],
        }
    ],
    "max_tokens": 200,
    "temperature": 0,
}
req = urllib.request.Request(
    "http://127.0.0.1:8081/v1/chat/completions",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
)
t0 = time.time()
m = json.load(urllib.request.urlopen(req, timeout=600))["choices"][0]["message"]
dt = time.time() - t0
print(f"elapsed {dt:.1f}s  answer: {(m.get('content') or '')[:80]!r}")
