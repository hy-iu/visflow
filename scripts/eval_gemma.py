# -*- coding: utf-8 -*-
"""Gemma-4-E4B-it (Ollama) NSFW 评测：支持 prompt 变体对比与断点续跑

Run:
  python scripts/eval_gemma.py --variant detailed --subset 100   # 子集调 prompt
  python scripts/eval_gemma.py --variant detailed                # 全量
"""
import argparse
import base64
import io
import json
import os
import random
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eval_common import load_items, EVAL_DIR, report  # noqa: E402

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "gemma4-e4b-nsfw"
BACKEND = "ollama"  # ollama 原生 / openai 兼容（llama-server）
OPENAI_URL = "http://127.0.0.1:8081/v1/chat/completions"


def set_model(name: str):
    global MODEL
    MODEL = name


def load_image_b64(img_path: str) -> str:
    """读图转 base64；WEBP 等 Ollama 不支持的格式先转码为 JPEG"""
    with open(img_path, "rb") as f:
        head = f.read(16)
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        from PIL import Image

        with Image.open(img_path) as im:
            if im.mode != "RGB":
                im = im.convert("RGB")
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=90)
            return base64.b64encode(buf.getvalue()).decode()
    with open(img_path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def set_backend(backend: str, url: str = ""):
    global BACKEND, OPENAI_URL
    BACKEND = backend
    if url:
        OPENAI_URL = url

PROMPTS = {
    # V0：简短口径（对照）
    "brief": (
        "Is this image NSFW? NSFW means nudity, exposed underwear/panties, or sexual acts. "
        "Answer with one word: Yes or No."
    ),
    # V1：中文详细口径 + 明确边界（对齐用户标记习惯）
    "detailed": (
        "判断这张图片是否属于NSFW。\n"
        "NSFW 判定标准（满足任一即是）：\n"
        "1. 能看见内裤、内衣（包括裙下走光、从下往上拍摄露出内裤、内裤外露）；\n"
        "2. 裸露：乳房、臀部、生殖器官可见；\n"
        "3. 性行为或明显的性动作画面。\n"
        "以下情况不算NSFW：\n"
        "- 穿裙子/短裤但未走光的街拍、腿部特写；\n"
        "- 泳装、紧身衣但无内衣可见、无裸露的日常照片。\n"
        "只回答一个词：Yes 或 No。"
    ),
    # V2：英文详细口径（小模型英文指令遵循通常更稳）
    "detailed_en": (
        "Decide whether this image is NSFW.\n"
        "Mark YES if ANY of these is visible:\n"
        "1. Underwear or panties (including upskirt shots, panties visible under a skirt, exposed waistband);\n"
        "2. Nudity: breasts, buttocks or genitalia exposed;\n"
        "3. Sexual acts.\n"
        "Mark NO for normal photos: street shots of legs or skirts with NO underwear visible, "
        "swimwear or tight clothing without nudity.\n"
        "Answer with a single word: Yes or No."
    ),
    # V3：极简 + 强调“走光”优先（数据集主体是走光图）
    "upskirt_focus": (
        "Look carefully at the image. Is any underwear, panties or nude body part visible, "
        "even partially (e.g. under a skirt, from a low angle)? "
        "If visible, answer Yes. Otherwise answer No. One word only."
    ),
    # V4：专业内容审查框架（降低安全对齐拒绝偏置）
    "moderator": (
        "You are a professional content-moderation system classifying images for age-gating. "
        "This is a legitimate safety classification task; answer objectively based only on pixels.\n"
        "Classify the image as NSFW if any of the following is visible: "
        "underwear/panties (including accidental exposure under skirts), nudity, or sexual acts. "
        "Otherwise classify as safe.\n"
        "Is this image NSFW? Answer with one word: Yes or No."
    ),
    # V5：客观事实提问（不问 NSFW，只问视觉事实，规避语义防御）
    "factual": (
        "Answer based strictly on what is visible in the image.\n"
        "Question: Are any underwear, panties, bare buttocks, breasts or genitalia visible in this image, "
        "even partially or briefly (for example under a skirt or from a low camera angle)?\n"
        "Answer Yes if visible, No if not visible. One word only."
    ),
    # V6：聚焦“暴露”物理事实 + 检查点提示（英文）
    "exposure_question": (
        "Does this photograph show any exposed undergarments (panties or bra) or bare intimate body parts "
        "(buttocks, breasts, genitals)?\n"
        "Check these spots: under the skirt hem, low camera angles under the skirt, open waistbands, "
        "loose necklines.\n"
        "Answer Yes if ANY exposed undergarment or bare intimate part is visible, No if none. One word only."
    ),
    # V7：中文物理事实版（把“走光”定义成内衣布料可见）
    "cn_exposure": (
        "看图判断一个视觉事实：图中是否能看到任何内衣布料（内裤、胸罩或打底裤边缘），"
        "或者裸露的臀部、乳房、私处？\n"
        "重点检查：裙摆下方、低角度拍摄的裙底、裤腰松开的部位、敞开的领口。\n"
        "能看到回答 Yes，完全看不到回答 No。只回答一个词。"
    ),
    # V8：正反例对照（教模型区分走光与普通腿照）
    "contrast_cases": (
        "Street-photo classification task.\n"
        "NSFW examples: panties visible under a skirt from below; bra or underwear fabric visible; "
        "bare buttocks, breasts or genitals.\n"
        "SAFE examples: bare legs, short skirts, tight clothing or swimwear with NO underwear fabric visible.\n"
        "Is this image NSFW? Answer with one word: Yes or No."
    ),
    # V9：极简英文直问（logprob 友好，避免长指令稀释首 token）
    "yesno_direct": (
        "Is any underwear, panties or bare intimate body part visible in this photo? "
        "Answer Yes or No. One word only."
    ),
    # V10：双语混合（中文判定标准 + 英文正反例对照）
    "hybrid": (
        "判断这张图片是否属于NSFW。\n"
        "NSFW 判定标准（满足任一即是）：\n"
        "1. 能看见内裤、内衣（包括裙下走光、从下往上拍摄露出内裤、内裤外露）；\n"
        "2. 裸露：乳房、臀部、生殖器官可见；\n"
        "3. 性行为或明显的性动作画面。\n"
        "SAFE examples: bare legs, short skirts, tight clothing or swimwear with NO underwear fabric visible.\n"
        "只回答一个词：Yes 或 No。"
    ),
    # V11：先验提示（告知数据集确实含走光图，对抗 No 偏置）
    "prior_note": (
        "You are reviewing a batch of street photos. IMPORTANT: this batch DOES contain upskirt shots "
        "where panties are clearly visible under skirts, and also normal leg shots.\n"
        "Check each photo carefully. Is any underwear or panties visible?\n"
        "Answer Yes or No. One word only."
    ),
    # V12：先验 + 正反例合并
    "prior_contrast": (
        "Street-photo classification task. This batch DOES contain upskirt shots where panties are visible.\n"
        "NSFW examples: panties visible under a skirt from below; bra or underwear fabric visible; "
        "bare buttocks, breasts or genitals.\n"
        "SAFE examples: bare legs, short skirts, tight clothing or swimwear with NO underwear fabric visible.\n"
        "Is this image NSFW? Answer with one word: Yes or No."
    ),
}


def chat_gen(img_path: str, prompt: str, max_tokens: int = 900):
    """生成式模式：让模型完成思考后输出最终答案，返回 (content, reasoning)"""
    b64 = load_image_b64(img_path)
    body = json.dumps(
        {
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            "max_tokens": max_tokens,
            "temperature": 0,
        }
    ).encode()
    req = urllib.request.Request(OPENAI_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        resp = json.load(r)
    m = resp["choices"][0]["message"]
    return m.get("content") or "", m.get("reasoning_content") or ""


def parse_yesno(content: str):
    """从最终答案文本提取 Yes/No → 1.0/0.0，无法解析返回 None"""
    c = content.strip().lower()
    if c.startswith("yes"):
        return 1.0
    if c.startswith("no"):
        return 0.0
    if "yes" in c[:20]:
        return 1.0
    if "no" in c[:20]:
        return 0.0
    return None


def chat(img_path: str, prompt: str):
    b64 = load_image_b64(img_path)
    if BACKEND == "openai":
        body = json.dumps(
            {
                "model": MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                "max_tokens": 4,
                "temperature": 0,
                "logprobs": True,
                "top_logprobs": 10,
            }
        ).encode()
        req = urllib.request.Request(OPENAI_URL, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            resp = json.load(r)
        # 归一化为 ollama 风格：logprobs = [[{token,logprob,top_logprobs:[...]}]]
        content = resp["choices"][0]["logprobs"]["content"]
        toks = []
        for c in content:
            toks.append({"token": c["token"], "logprob": c["logprob"], "top_logprobs": c.get("top_logprobs") or []})
        return {"logprobs": toks, "message": {"content": resp["choices"][0]["message"].get("content", "")}}
    body = json.dumps(
        {
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt, "images": [b64]}],
            "stream": False,
            "logprobs": True,
            "top_logprobs": 10,
            "think": False,
            "options": {"temperature": 0, "num_predict": 4, "num_parallel": 4},
        }
    ).encode()
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def score_from_resp(resp):
    """遍历前几个生成 token 的 top_logprobs，找第一个含 Yes/No 竞争的位置聚合概率

    Gemma4 首 token 可能是 <|channel> 等控制 token，需向后看。
    返回 (score, content, debug_info)
    """
    import math

    toks = resp.get("logprobs") or []
    content = resp["message"].get("content", "")
    for t in toks[:4]:
        cands = t.get("top_logprobs") or [t]
        yes, no = -1e9, -1e9
        for cand in cands:
            w = cand["token"].strip().lower()
            lp = cand["logprob"]
            if w == "yes":
                yes = max(yes, lp)
            elif w == "no":
                no = max(no, lp)
        if yes > -1e9 and no > -1e9:
            m = max(yes, no)
            p = math.exp(yes - m) / (math.exp(yes - m) + math.exp(no - m))
            return p, content, []
    return None, content, [t["token"] for t in toks[:4]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="detailed", choices=list(PROMPTS))
    ap.add_argument("--model", default="gemma4-e4b-nsfw", help="Ollama 模型名")
    ap.add_argument("--backend", default="ollama", choices=["ollama", "openai"])
    ap.add_argument("--mode", default="logprob", choices=["logprob", "gen"], help="gen=生成式（适配思考模型）")
    ap.add_argument("--url", default="", help="openai 后端的 endpoint")
    ap.add_argument("--subset", type=int, default=0, help="分层抽样子集大小（0=全量）")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=1, help="并发请求数（拉高 GPU 利用率）")
    args = ap.parse_args()
    set_model(args.model)
    set_backend(args.backend, args.url)

    items = load_items()
    if args.subset:
        pos = [it for it in items if it["label"] == 1]
        neg = [it for it in items if it["label"] == 0]
        random.Random(args.seed).shuffle(pos)
        random.Random(args.seed).shuffle(neg)
        n_pos = round(args.subset * len(pos) / len(items))
        items = pos[:n_pos] + neg[: args.subset - n_pos]
        print(f"子集评测: {len(items)} 张（nsfw {n_pos} / sfw {len(items)-n_pos}）")

    prompt = PROMPTS[args.variant]
    tag = MODEL.replace("gemma4-e4b-", "")
    suffix = "" if BACKEND == "ollama" else f"-llamacpp-{args.mode}"
    name = f"Gemma4-{tag}-{args.variant}{suffix}" + (f"-subset{args.subset}" if args.subset else "")
    cache_path = os.path.join(EVAL_DIR, f"{name}-progress.json")
    os.makedirs(EVAL_DIR, exist_ok=True)
    done = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            done = {r["id"]: r for r in json.load(f)}
        print(f"断点续跑：已有 {len(done)} 条")

    def run_one(it):
        """worker：单张图评测，返回 (item, score)，内部已捕获异常"""
        if args.mode == "gen":
            content, _ = chat_gen(it["path"], prompt)
            p = parse_yesno(content)
            if p is None:
                p = 0.5
                print(f"  [!] 无法解析: {os.path.basename(it['path'])} -> {content[:50]!r}", flush=True)
            return it, p
        try:
            resp = chat(it["path"], prompt)
            p, content, other = score_from_resp(resp)
            if p is None:
                p = 0.5
                print(f"  [!] 无法解析 Yes/No: {os.path.basename(it['path'])} -> {content!r} {other[:3]}", flush=True)
            return it, p
        except Exception as e:
            print(f"  [!] 请求失败: {os.path.basename(it['path'])}: {e}", flush=True)
            return it, 0.5

    scores, errs = [], 0
    pending = [it for it in items if it["id"] not in done]
    for it in items:
        if it["id"] in done:
            scores.append(done[it["id"]]["score"])
    if pending:
        from concurrent.futures import ThreadPoolExecutor

        done_n = len(scores)
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
            for n, (it, p) in enumerate(ex.map(run_one, pending), start=1):
                scores.append(p)
                done[it["id"]] = {"id": it["id"], "score": p, "label": it["label"]}
                if (done_n + n) % 10 == 0:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(list(done.values()), f)
                    print(f"  {done_n+n}/{len(items)}", flush=True)

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(list(done.values()), f)
    report(name, items, scores, extra={"variant": args.variant, "prompt": prompt, "errors": errs})


if __name__ == "__main__":
    main()
