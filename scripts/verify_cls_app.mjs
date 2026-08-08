// 对比应用侧（sharp fit:cover）与 Python 评测（PIL resize+crop）的分数一致性
// 从 Python 评测结果中抽 boundary 样本（分数 0.2~0.8）复算，验证预处理等价
import sharp from 'sharp'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MODEL = path.join(ROOT, 'models', 'nsfw-cls', 'nsfw-cls-yolo11s.onnx')
const SIZE = 224

const pyResult = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'datasets/nsfw-labeled/eval/YOLO11s-cls-5fold-CV.json'), 'utf-8')
)
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'datasets/nsfw-labeled/manifest.json'), 'utf-8'))
const byId = new Map(manifest.items.map((it) => [it.id, it]))

// 抽 boundary 样本（Python 分数 0.15~0.85），最多 15 张
const boundary = pyResult.items.filter((r) => r.score > 0.15 && r.score < 0.85).slice(0, 15)

async function classify(filePath) {
  const { data } = await sharp(filePath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const size = SIZE * SIZE
  const float32 = new Float32Array(3 * size)
  for (let i = 0; i < size; i++) {
    float32[i] = data[i * 3] / 255.0
    float32[size + i] = data[i * 3 + 1] / 255.0
    float32[2 * size + i] = data[i * 3 + 2] / 255.0
  }
  const session = await ort.InferenceSession.create(MODEL)
  const inputTensor = new ort.Tensor('float32', float32, [1, 3, SIZE, SIZE])
  const results = await session.run({ [session.inputNames[0]]: inputTensor })
  return results[session.outputNames[0]].data[0]
}

;(async () => {
  let maxDiff = 0
  let agree = 0
  console.log('样本                label  python  node    diff  判定一致')
  for (const r of boundary) {
    const it = byId.get(r.id)
    if (!it) continue
    const p = path.join(ROOT, 'datasets/nsfw-labeled', it.datasetPath)
    if (!fs.existsSync(p)) continue
    const nodeScore = await classify(p)
    const diff = Math.abs(nodeScore - r.score)
    maxDiff = Math.max(maxDiff, diff)
    const same = (nodeScore >= 0.5) === (r.score >= 0.5)
    if (same) agree++
    console.log(
      `${it.datasetPath.split('/').pop().slice(0, 22).padEnd(22)} ${String(r.label).padEnd(5)} ` +
        `${r.score.toFixed(3).padStart(6)} ${nodeScore.toFixed(3).padStart(6)} ${diff.toFixed(4).padStart(6)} ${same ? 'OK' : 'DIFF'}`
    )
  }
  console.log(`\nboundary 样本 ${boundary.length} 张：最大分数差 ${maxDiff.toFixed(4)}，判定一致 ${agree}/${boundary.length}`)
  console.log(maxDiff < 0.05 && agree === boundary.length ? '[PASS] 预处理等价，接入正确' : '[WARN] 存在偏差，需检查')
})().catch((e) => { console.error('FAIL:', e); process.exit(1) })
