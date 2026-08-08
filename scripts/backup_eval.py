"""备份评测结果到 D:\我的云端硬盘\data\visflow\eval-results"""
import os
import shutil

SRC = r"datasets\nsfw-labeled\eval"
DST = r"D:\我的云端硬盘\data\visflow\eval-results"
os.makedirs(DST, exist_ok=True)

copied = []
for fn in os.listdir(SRC):
    if not fn.endswith(".json") or "progress" in fn:
        continue
    shutil.copy2(os.path.join(SRC, fn), os.path.join(DST, fn))
    copied.append(fn)
shutil.copy2(os.path.join(SRC, "SUMMARY.md"), os.path.join(DST, "SUMMARY.md"))
copied.append("SUMMARY.md")

print(f"[OK] 已备份 {len(copied)} 个文件 -> {DST}")
for c in sorted(copied):
    print("  ", c)
