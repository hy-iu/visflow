import collections
import json
import os

d = json.load(open(r"datasets/nsfw-labeled/eval/Gemma4-nsfw-prior_contrast.json", encoding="utf-8"))
m = {it["id"]: it for it in json.load(open(r"datasets/nsfw-labeled/manifest.json", encoding="utf-8"))["items"]}
root = r"datasets/nsfw-labeled"

fails = [r for r in d["items"] if abs(r["score"] - 0.5) < 1e-9]
print(f"score=0.5 的样本数: {len(fails)}")
print("--- 前 25 个失败样本 ---")
for r in fails[:25]:
    it = m[r["id"]]
    p = os.path.join(root, it["datasetPath"])
    print(f"  {os.path.basename(p)} label={it['label']} {os.path.getsize(p)//1024}KB")

sizes = collections.Counter(os.path.getsize(os.path.join(root, m[r['id']]['datasetPath']))//1024 for r in fails)
print("--- 失败样本体积分布 ---")
for s, c in sizes.most_common(10):
    print(f"  {s}KB x {c}")
