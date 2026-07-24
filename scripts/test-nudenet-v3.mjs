/**
 * NudeNet v3 YOLO ONNX Test Script
 * Run: node scripts/test-nudenet-v3.mjs <image-path-or-folder>
 *
 * Uses onnxruntime-node + YOLOv8 model for accurate NSFW detection.
 * Detects COVERED body parts (underwear/swimwear) unlike older models.
 */

import ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODEL_PATH = path.resolve(__dirname, '../models/nudenet/640m.onnx')
const INPUT_SIZE = 640
const CONF_THRESHOLD = 0.55
const IOU_THRESHOLD = 0.5
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'])

// NudeNet v3 class labels (YOLO model)
const LABELS = [
  'EXPOSED_ANUS',        // 0
  'EXPOSED_ARMPITS',     // 1
  'COVERED_BELLY',       // 2
  'EXPOSED_BELLY',       // 3
  'COVERED_BUTTOCKS',    // 4
  'EXPOSED_BUTTOCKS',    // 5
  'FACE_F',              // 6
  'FACE_M',              // 7
  'FEET',                // 8
  'EXPOSED_FEET',        // 9
  'COVERED_BREAST_F',    // 10
  'EXPOSED_BREAST_F',    // 11
  'COVERED_GENITALIA_F', // 12
  'EXPOSED_GENITALIA_F', // 13
  'COVERED_BREAST_M',    // 14
  'EXPOSED_BREAST_M',    // 15
  'COVERED_GENITALIA_M', // 16
  'EXPOSED_GENITALIA_M', // 17
]

// NSFW = any EXPOSED_ or COVERED_ genitalia/buttocks/breast
const NSFW_CLASSES = new Set([0, 4, 5, 10, 11, 12, 13, 14, 15, 16, 17])
// Sexy/provocative = covered parts
const SEXY_CLASSES = new Set([2, 4, 8, 10, 12, 14, 16])

const targetPath = process.argv[2]
if (!targetPath) {
  console.log('Usage: node scripts/test-nudenet-v3.mjs <image-or-folder>')
  process.exit(1)
}

function nms(boxes, scores, iouThreshold) {
  const indices = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a])
  const keep = []
  const suppressed = new Set()

  for (const i of indices) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of indices) {
      if (j === i || suppressed.has(j)) continue
      const iou = computeIoU(boxes[i], boxes[j])
      if (iou > iouThreshold) suppressed.add(j)
    }
  }
  return keep
}

function computeIoU(a, b) {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter + 1e-6)
}

async function main() {
  console.log(`\n=== NudeNet v3 YOLO ONNX Test ===`)
  console.log(`Model: ${MODEL_PATH}`)
  console.log(`Input: ${INPUT_SIZE}x${INPUT_SIZE}, conf>${CONF_THRESHOLD}`)
  console.log(`Target: ${targetPath}\n`)

  // Load ONNX model
  console.log('Loading model...')
  const t0 = Date.now()
  const session = await ort.InferenceSession.create(MODEL_PATH)
  console.log(`Model loaded in ${Date.now() - t0}ms`)
  console.log(`Inputs: ${session.inputNames}`)
  console.log(`Outputs: ${session.outputNames}\n`)

  // Collect files
  let files = []
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(targetPath)) {
      if (IMAGE_EXTS.has(path.extname(f).toLowerCase())) {
        files.push(path.join(targetPath, f))
      }
    }
  } else {
    files.push(targetPath)
  }

  console.log(`Found ${files.length} image(s)\n`)
  console.log('─'.repeat(100))

  let nsfwCount = 0

  for (const filePath of files) {
    try {
      const t1 = Date.now()

      // Preprocess: resize to 640x640, normalize to [0,1], CHW format
      const { data, info } = await sharp(filePath)
        .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Convert HWC uint8 → CHW float32 [0,1]
      const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
      for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        float32Data[i] = data[i * 3] / 255.0                          // R
        float32Data[INPUT_SIZE * INPUT_SIZE + i] = data[i * 3 + 1] / 255.0      // G
        float32Data[2 * INPUT_SIZE * INPUT_SIZE + i] = data[i * 3 + 2] / 255.0  // B
      }

      const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE])
      const feeds = { [session.inputNames[0]]: inputTensor }
      const results = await session.run(feeds)

      // Parse YOLO output: [1, 22, 8400] = [batch, 4+numClasses, numDetections]
      const output = results[session.outputNames[0]]
      const outputData = output.data
      const dims = output.dims
      const numAttrs = dims[1]  // 22 = 4 box + 18 classes
      const numDetections = dims[2]  // 8400
      const numClasses = numAttrs - 4

      const sigmoid = (x) => 1 / (1 + Math.exp(-x))
      const boxes = []
      const scores = []
      const classIds = []

      for (let i = 0; i < numDetections; i++) {
        // Box: cx, cy, w, h (pixel coords in 640x640 space)
        const cx = outputData[0 * numDetections + i]
        const cy = outputData[1 * numDetections + i]
        const w = outputData[2 * numDetections + i]
        const h = outputData[3 * numDetections + i]

        // Find best class (apply sigmoid to raw logits)
        let maxScore = 0
        let maxClass = 0
        for (let c = 0; c < numClasses; c++) {
          const score = sigmoid(outputData[(4 + c) * numDetections + i])
          if (score > maxScore) {
            maxScore = score
            maxClass = c
          }
        }

        if (maxScore >= CONF_THRESHOLD) {
          // Convert cx,cy,w,h → x1,y1,x2,y2
          boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
          scores.push(maxScore)
          classIds.push(maxClass)
        }
      }

      // NMS
      const keep = nms(boxes, scores, IOU_THRESHOLD)
      const parts = keep.map(i => ({
        class: LABELS[classIds[i]] || `class_${classIds[i]}`,
        id: classIds[i],
        score: scores[i],
      }))

      // Determine status
      const hasNsfw = parts.some(p => NSFW_CLASSES.has(p.id))
      const hasSexy = parts.some(p => SEXY_CLASSES.has(p.id))
      const isNsfw = hasNsfw || hasSexy
      if (isNsfw) nsfwCount++

      const elapsed = Date.now() - t1
      const name = path.basename(filePath).slice(0, 40)
      const status = hasNsfw ? '🔴 NSFW' : hasSexy ? '🟡 SEXY' : '✅ SAFE'
      const partsStr = parts.length > 0
        ? parts.map(p => `${p.class}(${(p.score * 100).toFixed(0)}%)`).join(', ')
        : 'none'

      console.log(`${status}  ${name}`)
      console.log(`      Parts: ${partsStr}  [${elapsed}ms]`)
      console.log('')

    } catch (err) {
      console.log(`ERROR ${path.basename(filePath)}: ${err.message}\n`)
    }
  }

  console.log('─'.repeat(100))
  console.log(`\nResult: ${nsfwCount}/${files.length} flagged as NSFW/SEXY`)
}

main().catch(console.error)
