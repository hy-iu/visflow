r"""NSFW 手动标记备份脚本

Run: python scripts/backup_labels.py

1. 只读打开 visflow.db，导出所有带手动标记（safe/nsfw）的图片记录
2. 通过 sqlite3 backup API 生成数据库一致性快照（自动处理 WAL）
3. 输出到 D:\我的云端硬盘\data\visflow：
   - visflow-db-backup-<date>.db   数据库完整快照
   - nsfw-labels-<date>.json       标记数据（JSON）
   - nsfw-labels-<date>.csv        标记数据（CSV，便于人工核对）
"""

import csv
import json
import os
import sqlite3
from datetime import date, datetime

DB_PATH = os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "visflow", "visflow.db")
BACKUP_DIR = r"D:\我的云端硬盘\data\visflow"
DATE_TAG = date.today().isoformat()

if not os.path.exists(DB_PATH):
    raise SystemExit(f"数据库不存在: {DB_PATH}")

# URI readonly 模式打开，避免干扰（WAL 也可读）
db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
db.row_factory = sqlite3.Row

print("=== images 表 nsfw_status 分布 ===")
for row in db.execute("SELECT nsfw_status AS status, COUNT(*) AS n FROM images GROUP BY nsfw_status"):
    print(f"  {row['status'] or '(null)'}: {row['n']}")

labeled = db.execute(
    """SELECT id, file_path, file_name, nsfw_status AS label, nsfw_score,
              width, height, file_size, imported_at
       FROM images
       WHERE nsfw_status IN ('safe','nsfw')
       ORDER BY nsfw_status, imported_at"""
).fetchall()

safe_rows = [r for r in labeled if r["label"] == "safe"]
nsfw_rows = [r for r in labeled if r["label"] == "nsfw"]
print(f"\n手动标记总数: {len(labeled)}（safe {len(safe_rows)} / nsfw {len(nsfw_rows)}）")

missing = [r["file_path"] for r in labeled if not os.path.exists(r["file_path"])]
for p in missing:
    print(f"  [!] 文件缺失: {p}")
if not missing:
    print("所有标记图片的源文件均存在 [OK]")

os.makedirs(BACKUP_DIR, exist_ok=True)

records = [dict(r) for r in labeled]

json_path = os.path.join(BACKUP_DIR, f"nsfw-labels-{DATE_TAG}.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "exportedAt": datetime.now().isoformat(),
            "sourceDb": DB_PATH,
            "summary": {"safe": len(safe_rows), "nsfw": len(nsfw_rows), "total": len(records)},
            "labels": records,
        },
        f,
        ensure_ascii=False,
        indent=2,
    )
print(f"\nJSON 备份 -> {json_path}")

csv_path = os.path.join(BACKUP_DIR, f"nsfw-labels-{DATE_TAG}.csv")
with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["id", "file_path", "label", "nsfw_score", "width", "height", "file_size"])
    w.writeheader()
    for r in records:
        w.writerow({k: r[k] for k in w.fieldnames})
print(f"CSV  备份 -> {csv_path}")

db.close()

# 一致性快照：backup API 自动合并 WAL
src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
db_backup_path = os.path.join(BACKUP_DIR, f"visflow-db-backup-{DATE_TAG}.db")
dst = sqlite3.connect(db_backup_path)
with dst:
    src.backup(dst)
dst.close()
src.close()
print(f"DB   备份 -> {db_backup_path}")

print("\n[OK] 备份完成")
