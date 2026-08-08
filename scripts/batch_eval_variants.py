import json
import os
import subprocess
import sys

EVAL_DIR = r"datasets/nsfw-labeled/eval"
VARIANTS = ["exposure_question", "cn_exposure", "contrast_cases", "yesno_direct"]

for v in VARIANTS:
    print(f"=== {v} ===", flush=True)
    r = subprocess.run(
        [sys.executable, "-X", "utf8", "scripts/eval_gemma.py", "--variant", v, "--subset", "60"],
        capture_output=True,
        text=True,
    )
    print(r.stdout[-1500:], flush=True)
    if r.returncode != 0:
        print(r.stderr[-800:], flush=True)

print("\n=== SUMMARY ===", flush=True)
for v in VARIANTS:
    p = os.path.join(EVAL_DIR, f"Gemma4-nsfw-{v}-subset60.json")
    if os.path.exists(p):
        d = json.load(open(p, encoding="utf-8"))
        print(f"{v}: AUC={d['auc']:.4f} bestF1={d['bestF1']}", flush=True)
