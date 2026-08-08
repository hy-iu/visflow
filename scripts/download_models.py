# -*- coding: utf-8 -*-
"""从 ModelScope 下载候选模型到 F:\\models\\modelscope

Run: python scripts/download_models.py [名字...]
可选: vit / clip / qwen （默认全部）
"""
import os
import sys

os.environ.setdefault("MODELSCOPE_CACHE", r"F:\models\modelscope")

from modelscope import snapshot_download  # noqa: E402

TARGETS = {
    "vit": "AI-ModelScope/nsfw_image_detection",
    "clip": "AI-ModelScope/clip-vit-large-patch14",
    "qwen": "Qwen/Qwen2.5-VL-3B-Instruct",
}

names = sys.argv[1:] or list(TARGETS)
for n in names:
    repo = TARGETS[n]
    print(f"== 下载 {repo} ==", flush=True)
    p = snapshot_download(repo)
    print(f"   -> {p}", flush=True)

print("[OK] 全部下载完成")
