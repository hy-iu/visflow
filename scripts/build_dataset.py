r"""构建 NSFW 评测数据集（从备份的标记 JSON 复制图片）

Run: python scripts/build_dataset.py

输入:  D:\我的云端硬盘\data\visflow\nsfw-labels-<date>.json（或自动取最新一份）
输出:  datasets/nsfw-labeled/
       ├── sfw/     200 张正常图片
       ├── nsfw/    300 张 NSFW 图片
       └── manifest.json   记录 id -> 源路径 -> 数据集相对路径 的映射

文件名加 id 前 8 位防止同名冲突；ImageFolder 结构（sfw/nsfw 子目录）
可直接被 torchvision / timm / ultralytics classify 等框架读取。
"""

import glob
import json
import os
import shutil

BACKUP_DIR = r"D:\我的云端硬盘\data\visflow"
DATASET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets", "nsfw-labeled")

candidates = sorted(glob.glob(os.path.join(BACKUP_DIR, "nsfw-labels-*.json")))
if not candidates:
    raise SystemExit(f"未找到标记 JSON: {BACKUP_DIR}")
labels_path = candidates[-1]
print(f"使用标记文件: {labels_path}")

with open(labels_path, encoding="utf-8") as f:
    data = json.load(f)

labels = data["labels"]
print(f"标记总数: {len(labels)}（safe {data['summary']['safe']} / nsfw {data['summary']['nsfw']}）")

os.makedirs(os.path.join(DATASET_DIR, "sfw"), exist_ok=True)
os.makedirs(os.path.join(DATASET_DIR, "nsfw"), exist_ok=True)

manifest = {"source": labels_path, "items": []}
copied = skipped_missing = 0

for rec in labels:
    src = rec["file_path"]
    sub = "sfw" if rec["label"] == "safe" else "nsfw"
    ext = os.path.splitext(src)[1] or ".jpg"
    dst_name = f"{rec['id'][:8]}_{os.path.basename(src)}"
    dst = os.path.join(DATASET_DIR, sub, dst_name)

    if not os.path.exists(src):
        print(f"  [!] 源文件缺失，跳过: {src}")
        skipped_missing += 1
        continue
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    copied += 1
    manifest["items"].append(
        {
            "id": rec["id"],
            "label": rec["label"],
            "sourcePath": src,
            "datasetPath": f"{sub}/{dst_name}",
        }
    )

manifest["summary"] = {
    "sfw": sum(1 for i in manifest["items"] if i["label"] == "safe"),
    "nsfw": sum(1 for i in manifest["items"] if i["label"] == "nsfw"),
}
with open(os.path.join(DATASET_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"\n复制完成: {copied} 张, 缺失 {skipped_missing} 张")
print(f"数据集 -> {DATASET_DIR}")
print(f"  sfw : {manifest['summary']['sfw']}")
print(f"  nsfw: {manifest['summary']['nsfw']}")
