import json
import os
from PIL import Image

d = json.load(open(r"datasets/nsfw-labeled/eval/Gemma4-nsfw-prior_contrast.json", encoding="utf-8"))
m = {it["id"]: it for it in json.load(open(r"datasets/nsfw-labeled/manifest.json", encoding="utf-8"))["items"]}
root = r"datasets/nsfw-labeled"

fails = [r for r in d["items"] if abs(r["score"] - 0.5) < 1e-9]
for r in fails[:8]:
    p = os.path.join(root, m[r["id"]]["datasetPath"])
    try:
        im = Image.open(p)
        print(f"{os.path.basename(p)}: fmt={im.format} mode={im.mode} size={im.size} info_keys={list(im.info.keys())[:6]}")
    except Exception as e:
        print(f"{os.path.basename(p)}: OPEN FAIL {e}")

# 对照组：正常样本
ok = [r for r in d["items"] if abs(r["score"] - 0.5) >= 1e-9 and r["label"] == 0][:3]
for r in ok:
    p = os.path.join(root, m[r["id"]]["datasetPath"])
    try:
        im = Image.open(p)
        print(f"[OK] {os.path.basename(p)}: fmt={im.format} mode={im.mode} size={im.size}")
    except Exception as e:
        print(f"[OK] {os.path.basename(p)}: OPEN FAIL {e}")
