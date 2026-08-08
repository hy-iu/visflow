# -*- coding: utf-8 -*-
"""在自建数据集上微调 YOLO11s-cls（5折交叉验证 + 全量最终模型）

Run: python scripts/finetune_yolo.py [--epochs 25] [--model yolo11s-cls.pt]

1. 分层 5 折 CV：每折训练后在折外验证集上收集概率 → 汇总得到无偏估计
2. 全量 500 张训练最终模型，导出 ONNX 供应用集成
"""
import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from sklearn.model_selection import StratifiedKFold

from eval_common import load_items, DATASET_DIR, report

FOLD_ROOT = os.path.join(DATASET_DIR, "folds")
RUNS_DIR = os.path.join(DATASET_DIR, "runs")


def build_fold_dirs(items, n_splits=5, seed=42):
    """为每折创建 train/val 目录，用硬链接避免重复占用磁盘"""
    labels = np.array([it["label"] for it in items])
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    fold_of = np.zeros(len(items), dtype=int)
    for k, (_, val_idx) in enumerate(skf.split(np.zeros(len(items)), labels)):
        fold_of[val_idx] = k

    if os.path.exists(FOLD_ROOT):
        shutil.rmtree(FOLD_ROOT)
    for k in range(n_splits):
        for sub in ("train", "val"):
            for cls in ("sfw", "nsfw"):
                os.makedirs(os.path.join(FOLD_ROOT, f"fold{k}", sub, cls), exist_ok=True)

    for i, it in enumerate(items):
        cls = "nsfw" if it["label"] == 1 else "sfw"
        fname = os.path.basename(it["path"])
        # val：第 fold_of[i] 折；train：其余各折
        for k in range(n_splits):
            sub = "val" if fold_of[i] == k else "train"
            dst = os.path.join(FOLD_ROOT, f"fold{k}", sub, cls, fname)
            if not os.path.exists(dst):
                os.link(it["path"], dst)
    return fold_of


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--model", default="yolo11s-cls.pt")
    ap.add_argument("--imgsz", type=int, default=224)
    ap.add_argument("--final-only", action="store_true", help="跳过CV，只训练全量最终模型并导出")
    args = ap.parse_args()

    from ultralytics import YOLO

    items = load_items()

    if not args.final_only:
        fold_of = build_fold_dirs(items)

        all_scores = np.zeros(len(items))
        for k in range(5):
            fold_dir = os.path.join(FOLD_ROOT, f"fold{k}")
            print(f"\n===== Fold {k+1}/5 =====", flush=True)
            model = YOLO(args.model)
            model.train(
                data=fold_dir,
                epochs=args.epochs,
                imgsz=args.imgsz,
                batch=32,
                device=0,
                project=RUNS_DIR,
                name=f"fold{k}",
                exist_ok=True,
                verbose=False,
                patience=8,
                fliplr=0.5,
            )
            # 折外验证集打分
            val_idx = [i for i in range(len(items)) if fold_of[i] == k]
            paths = [items[i]["path"] for i in val_idx]
            preds = model.predict(paths, imgsz=args.imgsz, verbose=False, device=0)
            for i, p in zip(val_idx, preds):
                names = p.names
                probs = p.probs
                nsfw_c = next(c for c, n in names.items() if n == "nsfw")
                all_scores[i] = probs.data[nsfw_c].item()
            print(f"Fold {k+1} val done", flush=True)

        best_f1, best_thr, a = report("YOLO11s-cls-5fold-CV", items, all_scores)
    else:
        best_f1, best_thr, a = None, None, None

    # 全量训练最终模型（ultralytics classify 需要 train/ 子目录）
    print("\n===== 全量训练最终模型 =====", flush=True)
    full_dir = os.path.join(FOLD_ROOT, "full")
    for sub in ("train", "val"):
        for cls in ("sfw", "nsfw"):
            os.makedirs(os.path.join(full_dir, sub, cls), exist_ok=True)
    for it in items:
        cls = "nsfw" if it["label"] == 1 else "sfw"
        fname = os.path.basename(it["path"])
        for sub in ("train", "val"):
            dst = os.path.join(full_dir, sub, cls, fname)
            if not os.path.exists(dst):
                os.link(it["path"], dst)

    model = YOLO(args.model)
    model.train(
        data=full_dir,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=32,
        device=0,
        project=RUNS_DIR,
        name="final",
        exist_ok=True,
        verbose=False,
        fliplr=0.5,
    )
    out_onnx = os.path.join(DATASET_DIR, "nsfw-cls-yolo11s.onnx")
    model.export(format="onnx", imgsz=args.imgsz)
    exported = os.path.join(RUNS_DIR, "final", "weights", "best.onnx")
    if os.path.exists(exported):
        shutil.copy2(exported, out_onnx)
    print(f"\n[OK] ONNX 导出 -> {out_onnx}")
    if best_f1 is not None:
        print(f"[OK] CV 最优 F1={best_f1:.3f} (thr={best_thr:.2f}), AUC={a:.4f}")


if __name__ == "__main__":
    main()
