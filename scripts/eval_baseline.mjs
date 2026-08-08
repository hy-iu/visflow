/**
 * 基线评测：复现应用内 nsfwjs InceptionV3 + NudeNet v3 YOLO 双模型管线
 * Run: node scripts/eval_baseline.mjs
 *
 * 对 datasets/nsfw-labeled 全量 500 张图输出各模型原始分数到
 * datasets/nsfw-labeled/eval/baseline-nodenet.json，再由 Python 统一算指标。
 */

import * as tf from '@tensorflow/tfjs'
import * as tfWasm from '@tensorflow/tfjs-backend-wasm'
import * as nsfwjs from 'nsfwjs'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATASET_DIR = path.join(ROOT, 'datasets', 'nsfw-labeled')
const EVAL_DIR = path.join(DATASET_DIR, 'eval')
const YOLO_MODEL = path.join(ROOT, 'models', 'nudenet', '640m.onnx')

const NSFW_THRESHOLD = 0.45
const YOLO_CONF = 0.55
const YOLO_SIZE = 640

// NudeNet v3 labels（与 src/main/services/nsfw.ts 一致）
const NSFW_CLASSES = new Set([0, 4, 5, 10, 11, 12, 13, 14, 15, 16, 17])
const SEXY_CLASSES = new Set([2, 4, 8, 10, 12, 14, 16])

function nms(boxes, scores, iouThr) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a])
  const keep = []
  const dead = new Set()
  for (const i of order) {
    if (dead.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (j === i || dead.has(j)) continue
      const [ax1, ay1, ax2, ay2] = boxes[i]
      const [bx1, by1, bx2, by2] = boxes[j]
      const inter = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) * Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1))
      const uni = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter + 1e-6
      if (inter / uni > iouThr) dead.add(j)
    }
  }
  return keep
}

async function yoloScores(session, filePath) {
  const { data } = await sharp(filePath).resize(YOLO_SIZE, YOLO_SIZE, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const size = YOLO_SIZE * YOLO_SIZE
  const f32 = new Float32Array(3 * size)
  for (let i = 0; i < size; i++) {
    f32[i] = data[i * 3] / 255
    f32[size + i] = data[i * 3 + 1] / 255
    f32[2 * size + i] = data[i * 3 + 2] / 255
  }
  const results = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', f32, [1, 3, YOLO_SIZE, YOLO_SIZE]) })
  const out = results[session.outputNames[0]]
  const d = out.data
  const numDet = out.dims[2]
  const numCls = out.dims[1] - 4
  const sigmoid = (x) => 1 / (1 + Math.exp(-x))

  const boxes = [], scores = [], cls = []
  for (let i = 0; i < numDet; i++) {
    let best = 0, bestC = 0
    for (let c = 0; c < numCls; c++) {
      const s = sigmoid(d[(4 + c) * numDet + i])
      if (s > best) { best = s; bestC = c }
    }
    if (best >= YOLO_CONF) {
      const cx = d[i], cy = d[numDet + i], w = d[2 * numDet + i], h = d[3 * numDet + i]
      boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
      scores.push(best)
      cls.push(bestC)
    }
  }
  const keep = nms(boxes, scores, 0.5)
  let maxNsfw = 0, maxSexy = 0
  for (const i of keep) {
    if (NSFW_CLASSES.has(cls[i])) maxNsfw = Math.max(maxNsfw, scores[i])
    if (SEXY_CLASSES.has(cls[i])) maxSexy = Math.max(maxSexy, scores[i])
  }
  return { maxNsfw, maxSexy, hit: keep.some((i) => NSFW_CLASSES.has(cls[i]) || SEXY_CLASSES.has(cls[i])) }
}

async function main() {
  // WASM backend（与开发模式一致）
  try {
    tfWasm.setWasmPaths(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')) + '/dist/')
    await tf.setBackend('wasm')
    await tf.ready()
    console.log('[baseline] WASM backend ready')
  } catch (e) {
    console.warn('[baseline] WASM failed, fallback:', e.message)
    await tf.ready()
  }

  console.log('[baseline] loading nsfwjs InceptionV3 ...')
  const mdl = await nsfwjs.load('InceptionV3', { size: 299 })
  console.log('[baseline] loading NudeNet v3 ONNX ...')
  const session = await ort.InferenceSession.create(YOLO_MODEL)

  const manifest = JSON.parse(fs.readFileSync(path.join(DATASET_DIR, 'manifest.json'), 'utf8'))
  const results = []
  let n = 0
  const t0 = Date.now()

  for (const it of manifest.items) {
    const filePath = path.join(DATASET_DIR, it.datasetPath.split('/').join(path.sep))
    n++
    try {
      // nsfwjs
      const { data } = await sharp(filePath).resize(299, 299, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const tensor = tf.tensor3d(new Uint8Array(data), [299, 299, 3])
      let nsfwjsScore = 0
      const raw = {}
      try {
        const preds = await mdl.classify(tensor)
        for (const p of preds) {
          raw[p.className] = p.probability
          if (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') nsfwjsScore += p.probability
        }
      } finally {
        tensor.dispose()
      }

      // NudeNet YOLO（全量跑，不像应用里提前短路，便于统计原始分数）
      const yolo = await yoloScores(session, filePath)

      const flagged = nsfwjsScore >= NSFW_THRESHOLD || yolo.hit
      results.push({
        id: it.id,
        label: it.label === 'nsfw' ? 1 : 0,
        nsfwjsScore,
        nsfwjsRaw: raw,
        yoloMaxNsfw: yolo.maxNsfw,
        yoloMaxSexy: yolo.maxSexy,
        yoloHit: yolo.hit,
        flagged
      })
    } catch (err) {
      console.error(`ERROR ${it.datasetPath}: ${err.message}`)
      results.push({ id: it.id, label: it.label === 'nsfw' ? 1 : 0, error: err.message })
    }
    if (n % 20 === 0) {
      const dt = Date.now() - t0
      console.log(`  ${n}/${manifest.items.length}  (${(dt / n).toFixed(0)} ms/img)`)
    }
  }

  fs.mkdirSync(EVAL_DIR, { recursive: true })
  const outPath = path.join(EVAL_DIR, 'baseline-dual-model.json')
  fs.writeFileSync(outPath, JSON.stringify({ model: 'baseline-dual-model', threshold: NSFW_THRESHOLD, items: results }, null, 1))
  console.log(`\n[baseline] done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${outPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
