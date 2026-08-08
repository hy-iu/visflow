import json
import urllib.request

req = urllib.request.Request(
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/b10328",
    headers={"User-Agent": "curl/8"},
)
data = json.load(urllib.request.urlopen(req, timeout=30))
for a in data["assets"]:
    n = a["name"].lower()
    if "win" in n and ("cuda" in n or "vulkan" in n) and "x64" in n:
        size = a["size"] / 1e6
        print(f"{size:8.1f} MB  {a['name']}")
