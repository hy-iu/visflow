"""Download the CUDA 13.3 runtime pack for llama.cpp and extract into F:\models\llama.cpp"""
import io
import json
import os
import sys
import urllib.request
import zipfile

DEST = r"F:\models\llama.cpp"
CANDIDATES = [
    "https://github.com/ggml-org/llama.cpp/releases/download/b10328/cudart-llama-bin-win-cuda-13.3-x64.zip",
    "https://ghproxy.net/https://github.com/ggml-org/llama.cpp/releases/download/b10328/cudart-llama-bin-win-cuda-13.3-x64.zip",
    "https://gh-proxy.com/https://github.com/ggml-org/llama.cpp/releases/download/b10328/cudart-llama-bin-win-cuda-13.3-x64.zip",
]

for url in CANDIDATES:
    try:
        print(f"[OK] downloading {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            total = int(resp.headers.get("Content-Length") or 0)
            buf = bytearray()
            done = 0
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                buf.extend(chunk)
                done += len(chunk)
                if total:
                    print(f"  {done/1e6:.0f}/{total/1e6:.0f} MB ({done/total*100:.0f}%)", flush=True)
        print(f"[OK] downloaded {len(buf)/1e6:.0f} MB, extracting...", flush=True)
        with zipfile.ZipFile(io.BytesIO(buf)) as z:
            names = z.namelist()
            for n in names:
                if n.endswith(".dll") or n.endswith(".json") or n.endswith(".md") or n.endswith(".exe"):
                    z.extract(n, DEST)
            print(f"[OK] extracted {len(names)} files -> {DEST}", flush=True)
            print("\n".join(x for x in names if "cudart" in x.lower() or "cublas" in x.lower())[:2000], flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"[FAIL] {url}: {e}", flush=True)
sys.exit(1)
