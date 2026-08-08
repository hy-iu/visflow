# -*- coding: utf-8 -*-
r"""下载最新 llama.cpp Windows CUDA 版并解压到 F:\models\llama.cpp"""
import json
import os
import shutil
import urllib.request
import zipfile

DEST = r"F:\models\llama.cpp"

req = urllib.request.Request(
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest",
    headers={"User-Agent": "curl/8"},
)
data = json.load(urllib.request.urlopen(req, timeout=30))
print("tag:", data["tag_name"])

asset = None
cuda_candidates = []
for a in data["assets"]:
    n = a["name"].lower()
    if n.startswith("llama-") and "-bin-" in n and "win" in n and "cuda" in n and "x64" in n and n.endswith(".zip"):
        cuda_candidates.append(a)
# RTX 5060 Ti (Blackwell) 需要 CUDA 12.8+ 构建，优先高版本
cuda_candidates.sort(key=lambda a: a["name"], reverse=True)
if cuda_candidates:
    asset = cuda_candidates[0]
    print(f"选择: {asset['name']}  ({asset['size']/1e6:.0f} MB)")
if asset is None:
    # 退而求其次：CPU 版
    for a in data["assets"]:
        n = a["name"].lower()
        if "win" in n and "x64" in n and n.endswith(".zip"):
            asset = a
            print(f"备选: {a['name']}  ({a['size']/1e6:.0f} MB)")
            break

zip_path = os.path.join(DEST + ".zip")
os.makedirs(os.path.dirname(zip_path), exist_ok=True)
direct_url = asset["browser_download_url"]
mirrors = [direct_url] + [m + direct_url for m in (
    "https://ghfast.top/",
    "https://gh-proxy.com/",
    "https://mirror.ghproxy.com/",
)]
ok = False
for url in mirrors:
    print("尝试下载:", url[:100], "...")
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(zip_path, "wb") as f:
            shutil.copyfileobj(r, f)
        if os.path.getsize(zip_path) > 10 * 1e6:
            ok = True
            break
    except Exception as e:
        print("  失败:", str(e)[:120])
if not ok:
    raise SystemExit("所有下载源均失败")
print("下载完成，解压 ...")
if os.path.exists(DEST):
    shutil.rmtree(DEST)
with zipfile.ZipFile(zip_path) as z:
    z.extractall(DEST)
os.remove(zip_path)
print("完成 ->", DEST)
for fn in os.listdir(DEST):
    if fn.endswith(".exe") and ("mtmd" in fn or "server" in fn or "quantize" in fn):
        print("  ", fn)
