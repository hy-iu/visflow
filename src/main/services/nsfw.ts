/**
 * @fileoverview NSFW detection service for VisFlow.
 *
 * Primary engine: YOLO11s-cls image classifier (ONNX, finetuned on user data).
 * Fallback: dual-model approach:
 * 1. nsfwjs InceptionV3 (TFJS) — image classification (Porn/Hentai/Sexy)
 * 2. NudeNet v3 YOLO (ONNX) — object detection (COVERED_BUTTOCKS, EXPOSED_*, etc.)
 *
 * An image is flagged NSFW if the classifier scores >= CLS_THRESHOLD.
 * When the classifier is unavailable, falls back to the dual-model logic:
 * flagged if EITHER model detects it.
 */

import * as tf from '@tensorflow/tfjs'
import * as tfWasm from '@tensorflow/tfjs-backend-wasm'
import * as nsfwjs from 'nsfwjs'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { app, net, shell } from 'electron'
import { getDb } from '../db/connection'
import { images } from '../db/schema'
import { eq, isNull } from 'drizzle-orm'

let nsfwModel: nsfwjs.NSFWJS | null = null
let yoloSession: ort.InferenceSession | null = null
let clsSession: ort.InferenceSession | null = null
let scanCancelled = false
let backendReady = false

/** Classifier model file name (YOLO11s-cls, finetuned on user labels). */
const CLS_MODEL_FILENAME = 'nsfw-cls-yolo11s.onnx'
/** YOLO model file name (NudeNet v3). */
const YOLO_MODEL_FILENAME = '640m.onnx'
/**
 * Download source for the YOLO model.
 * Models are NOT bundled with the app; users download them on demand.
 */
const YOLO_MODEL_URL =
  'https://github.com/hy-iu/visflow/releases/download/nsfw-models/640m.onnx'

/**
 * Directory where user-installed NSFW models live (inside userData).
 * Stored outside the install dir so models survive app updates.
 */
export function getModelDir(): string {
  return path.join(app.getPath('userData'), 'models', 'nudenet')
}

/** Directory for the YOLO11s-cls classifier model. */
export function getClsModelDir(): string {
  return path.join(app.getPath('userData'), 'models', 'nsfw-cls')
}

/**
 * Resolve the classifier model path. Checks the user data dir first, then falls
 * back to the project root (development convenience). Returns null if absent.
 */
function resolveClsModelPath(): string | null {
  const candidates = [
    path.join(getClsModelDir(), CLS_MODEL_FILENAME),
    path.join(app.getAppPath(), 'models', 'nsfw-cls', CLS_MODEL_FILENAME)
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Resolve the YOLO model path. Checks the user data dir first, then falls
 * back to the project root (development convenience). Returns null if absent.
 */
function resolveYoloModelPath(): string | null {
  const candidates = [
    path.join(getModelDir(), YOLO_MODEL_FILENAME),
    path.join(app.getAppPath(), 'models', 'nudenet', YOLO_MODEL_FILENAME)
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export interface NsfwModelStatus {
  /** Whether the YOLO11s-cls classifier model is installed. */
  clsInstalled: boolean
  /** Resolved path of the classifier model, or null. */
  clsPath: string | null
  /** Directory where the classifier model should be placed. */
  clsModelDir: string
  /** Whether the YOLO (NudeNet) model is installed. */
  yoloInstalled: boolean
  /** Resolved path of the YOLO model, or null. */
  yoloPath: string | null
  /** Directory where models should be placed. */
  modelDir: string
  /** Download URL for the YOLO model. */
  downloadUrl: string
}

/** Report which NSFW models are currently available. */
export function getModelStatus(): NsfwModelStatus {
  const clsPath = resolveClsModelPath()
  const yoloPath = resolveYoloModelPath()
  return {
    clsInstalled: clsPath !== null,
    clsPath,
    clsModelDir: getClsModelDir(),
    yoloInstalled: yoloPath !== null,
    yoloPath,
    modelDir: getModelDir(),
    downloadUrl: YOLO_MODEL_URL
  }
}

export interface ModelDownloadProgress {
  phase: 'downloading' | 'done' | 'error'
  receivedBytes: number
  totalBytes: number
  percent: number
  error?: string
}

/**
 * Download the YOLO model into the user data model dir, streaming to a temp
 * file and renaming on completion. Reports progress via the callback.
 */
export async function downloadYoloModel(
  onProgress?: (p: ModelDownloadProgress) => void
): Promise<{ success: boolean; error?: string }> {
  const dir = getModelDir()
  fs.mkdirSync(dir, { recursive: true })
  const finalPath = path.join(dir, YOLO_MODEL_FILENAME)
  const tmpPath = `${finalPath}.download`

  try {
    await new Promise<void>((resolve, reject) => {
      const request = net.request({ url: YOLO_MODEL_URL, redirect: 'follow' })
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败：HTTP ${response.statusCode}`))
          return
        }
        const totalBytes = parseInt((response.headers['content-length'] as string) || '0', 10)
        let receivedBytes = 0
        const fileStream = fs.createWriteStream(tmpPath)
        response.on('data', (chunk: Buffer) => {
          fileStream.write(chunk)
          receivedBytes += chunk.length
          onProgress?.({
            phase: 'downloading',
            receivedBytes,
            totalBytes,
            percent: totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0
          })
        })
        response.on('end', () => fileStream.end(() => resolve()))
        response.on('error', reject)
        fileStream.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })
    fs.renameSync(tmpPath, finalPath)
    // Reset cached session so the next scan picks up the new model.
    yoloSession = null
    onProgress?.({ phase: 'done', receivedBytes: 0, totalBytes: 0, percent: 100 })
    return { success: true }
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    } catch {
      /* ignore cleanup errors */
    }
    const msg = err instanceof Error ? err.message : String(err)
    onProgress?.({ phase: 'error', receivedBytes: 0, totalBytes: 0, percent: 0, error: msg })
    return { success: false, error: msg }
  }
}

/** Open the model directory in the system file manager (for manual install). */
export async function openModelDir(): Promise<string> {
  const dir = getModelDir()
  fs.mkdirSync(dir, { recursive: true })
  await shell.openPath(dir)
  return dir
}

/** Open the classifier model directory in the system file manager. */
export async function openClsModelDir(): Promise<string> {
  const dir = getClsModelDir()
  fs.mkdirSync(dir, { recursive: true })
  await shell.openPath(dir)
  return dir
}

/** nsfwjs threshold: Porn+Hentai+Sexy probability sum */
const NSFW_THRESHOLD = 0.45
/** YOLO11s-cls classifier threshold (finetuned, best-F1 on user data) */
const CLS_THRESHOLD = 0.5
/** YOLO confidence threshold (sigmoid output) */
const YOLO_CONF = 0.55
const YOLO_INPUT_SIZE = 640
const YOLO_IOU = 0.5
/** Classifier input size */
const CLS_INPUT_SIZE = 224

/** YOLO classes that indicate NSFW content */
const YOLO_NSFW_CLASSES = new Set([
  0,  // EXPOSED_ANUS
  4,  // COVERED_BUTTOCKS
  5,  // EXPOSED_BUTTOCKS
  10, // COVERED_BREAST_F
  11, // EXPOSED_BREAST_F
  12, // COVERED_GENITALIA_F
  13, // EXPOSED_GENITALIA_F
  14, // COVERED_BREAST_M
  15, // EXPOSED_BREAST_M
  16, // COVERED_GENITALIA_M
  17, // EXPOSED_GENITALIA_M
])
/** YOLO classes that indicate sexy/provocative content */
const YOLO_SEXY_CLASSES = new Set([
  2,  // COVERED_BELLY
  3,  // EXPOSED_BELLY
  4,  // COVERED_BUTTOCKS
  8,  // FEET
  9,  // EXPOSED_FEET
  10, // COVERED_BREAST_F
  12, // COVERED_GENITALIA_F
  14, // COVERED_BREAST_M
  16, // COVERED_GENITALIA_M
])

/**
 * Initialize TensorFlow.js WASM backend for better performance.
 */
async function ensureBackend(): Promise<void> {
  if (backendReady) return
  try {
    // WASM binary files are copied to resources/tfjs-wasm/ by electron-builder.
    // In dev mode, resolve from node_modules directly.
    const wasmPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tfjs-wasm') + '/'
      : path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm')) + '/'
    tfWasm.setWasmPaths(wasmPath)
    await tf.setBackend('wasm')
    await tf.ready()
    console.log('[NSFW] Using WASM backend, wasmPath:', wasmPath)
  } catch (err) {
    console.warn('[NSFW] WASM backend failed, falling back to default:', err)
    await tf.ready()
  }
  backendReady = true
}

/**
 * Load the nsfwjs InceptionV3 model (lazy singleton).
 */
async function getNsfwModel(): Promise<nsfwjs.NSFWJS> {
  if (nsfwModel) return nsfwModel
  await ensureBackend()
  nsfwModel = await nsfwjs.load('InceptionV3', { size: 299 })
  return nsfwModel
}

/**
 * Load the YOLO11s-cls classifier ONNX model (lazy singleton).
 * Returns null if the model is not installed.
 */
async function getClsSession(): Promise<ort.InferenceSession | null> {
  if (clsSession) return clsSession
  try {
    const modelPath = resolveClsModelPath()
    if (!modelPath) {
      console.warn(
        '[NSFW] Classifier model not installed. Expected at:',
        path.join(getClsModelDir(), CLS_MODEL_FILENAME)
      )
      return null
    }
    clsSession = await ort.InferenceSession.create(modelPath)
    console.log('[NSFW] Classifier model loaded from:', modelPath)
    return clsSession
  } catch (err) {
    console.warn('[NSFW] Failed to load classifier model:', err)
    return null
  }
}

/**
 * Load the NudeNet YOLO ONNX model (lazy singleton).
 */
async function getYoloSession(): Promise<ort.InferenceSession | null> {
  if (yoloSession) return yoloSession
  try {
    // Model location: user data dir (downloaded on demand), project root in dev.
    const modelPath = resolveYoloModelPath()
    if (!modelPath) {
      console.warn(
        '[NSFW] YOLO model not installed. Expected at:',
        path.join(getModelDir(), YOLO_MODEL_FILENAME)
      )
      return null
    }
    yoloSession = await ort.InferenceSession.create(modelPath)
    console.log('[NSFW] YOLO model loaded from:', modelPath)
    return yoloSession
  } catch (err) {
    console.warn('[NSFW] Failed to load YOLO model:', err)
    return null
  }
}

export interface NsfwScanProgress {
  current: number
  total: number
  fileName: string
  /** Number of images flagged as NSFW so far */
  flagged: number
}

/**
 * Cancel an in-progress scan.
 */
export function cancelNsfwScan(): void {
  scanCancelled = true
}

/**
 * Scan all pending (unscanned) images for NSFW content.
 * Processes images concurrently (CONCURRENCY workers) to saturate CPU/GPU.
 *
 * @param onProgress - callback invoked after each image is processed
 * @returns total number of images flagged as NSFW
 */
export async function scanPendingImages(
  onProgress?: (p: NsfwScanProgress) => void
): Promise<{ scanned: number; flagged: number }> {
  scanCancelled = false
  const db = getDb()

  // Get all images that haven't been scanned yet
  const pending = db
    .select()
    .from(images)
    .where(isNull(images.nsfwScore))
    .all()

  if (pending.length === 0) return { scanned: 0, flagged: 0 }

  const mdl = await getNsfwModel()
  const yolo = await getYoloSession()
  const cls = await getClsSession()
  const threshold = cls ? CLS_THRESHOLD : NSFW_THRESHOLD
  let scanned = 0
  let flagged = 0

  // 并发池：同时处理 CONCURRENCY 张，每张完成后补下一个，直到全部完成
  const CONCURRENCY = 4
  let next = 0

  async function processOne(img: typeof pending[number]): Promise<void> {
    const fileName = img.fileName || path.basename(img.filePath)
    try {
      const score = await classifyImage(cls, mdl, yolo, img.filePath)
      const status = score >= threshold ? 'nsfw' : 'safe'
      if (status === 'nsfw') flagged++

      db.update(images)
        .set({
          nsfwScore: Math.round(score * 1000),
          nsfwStatus: status,
          updatedAt: Date.now()
        })
        .where(eq(images.id, img.id))
        .run()
    } catch (err) {
      console.error(`NSFW scan failed for ${fileName}:`, err)
      // Mark as safe on error to avoid re-processing
      db.update(images)
        .set({ nsfwScore: 0, nsfwStatus: 'safe', updatedAt: Date.now() })
        .where(eq(images.id, img.id))
        .run()
    }
    scanned++
    onProgress?.({ current: scanned, total: pending.length, fileName, flagged })
  }

  async function worker(): Promise<void> {
    while (!scanCancelled) {
      const idx = next++
      if (idx >= pending.length) return
      await processOne(pending[idx])
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  onProgress?.({ current: scanned, total: pending.length, fileName: '完成', flagged })
  return { scanned, flagged }
}

/**
 * Classify a single image.
 * Uses the YOLO11s-cls classifier when available; otherwise falls back to the
 * dual-model approach (nsfwjs + NudeNet). Returns NSFW probability (0-1).
 */
async function classifyImage(
  cls: ort.InferenceSession | null,
  mdl: nsfwjs.NSFWJS,
  yolo: ort.InferenceSession | null,
  filePath: string
): Promise<number> {
  if (!fs.existsSync(filePath)) return 0

  // === Primary: YOLO11s-cls classifier (finetuned on user data) ===
  if (cls) {
    try {
      const clsScore = await classifyWithCls(cls, filePath)
      if (clsScore !== null) return clsScore
    } catch (err) {
      console.warn('[NSFW] Classifier inference failed, falling back:', err)
    }
  }

  // === Fallback: dual-model (nsfwjs InceptionV3 + NudeNet YOLO) ===
  // === Pass 1: nsfwjs InceptionV3 ===
  const { data: data299, info: info299 } = await sharp(filePath)
    .resize(299, 299, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const tensor = tf.tensor3d(new Uint8Array(data299), [info299.height, info299.width, 3])
  let nsfwScore = 0
  try {
    const predictions = await mdl.classify(tensor)
    for (const p of predictions) {
      if (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') {
        nsfwScore += p.probability
      }
    }
  } finally {
    tensor.dispose()
  }

  // If nsfwjs already flags it, no need for YOLO
  if (nsfwScore >= NSFW_THRESHOLD) return nsfwScore

  // === Pass 2: YOLO NudeNet (only if nsfwjs didn't flag) ===
  if (yolo) {
    try {
      const yoloHit = await detectYolo(yolo, filePath)
      if (yoloHit) {
        // YOLO detected NSFW/SEXY content — boost score above threshold
        return Math.max(nsfwScore, NSFW_THRESHOLD + 0.01)
      }
    } catch (err) {
      console.warn('[NSFW] YOLO detection failed:', err)
    }
  }

  return nsfwScore
}

/**
 * Run the YOLO11s-cls classifier. Returns NSFW probability (0-1), or null on failure.
 * Preprocessing matches training: short-edge resize + center crop to 224x224,
 * normalized to [0,1] (the exported ONNX embeds ImageNet normalization).
 * Output classes: [nsfw, sfw].
 */
async function classifyWithCls(
  session: ort.InferenceSession,
  filePath: string
): Promise<number | null> {
  try {
    const { data } = await sharp(filePath)
      .resize(CLS_INPUT_SIZE, CLS_INPUT_SIZE, { fit: 'cover', position: 'centre' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // HWC uint8 → CHW float32 [0,1]
    const size = CLS_INPUT_SIZE * CLS_INPUT_SIZE
    const float32 = new Float32Array(3 * size)
    for (let i = 0; i < size; i++) {
      float32[i] = data[i * 3] / 255.0
      float32[size + i] = data[i * 3 + 1] / 255.0
      float32[2 * size + i] = data[i * 3 + 2] / 255.0
    }

    const inputTensor = new ort.Tensor('float32', float32, [1, 3, CLS_INPUT_SIZE, CLS_INPUT_SIZE])
    const results = await session.run({ [session.inputNames[0]]: inputTensor })
    const output = results[session.outputNames[0]]
    const probs = output.data as Float32Array
    // 类别序：[nsfw, sfw]
    return probs[0]
  } catch (err) {
    console.warn('[NSFW] Classifier inference error:', err)
    return null
  }
}

/**
 * Run YOLO NudeNet detection. Returns true if NSFW/SEXY parts detected.
 */
async function detectYolo(session: ort.InferenceSession, filePath: string): Promise<boolean> {
  const { data } = await sharp(filePath)
    .resize(YOLO_INPUT_SIZE, YOLO_INPUT_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // HWC uint8 → CHW float32 [0,1]
  const size = YOLO_INPUT_SIZE * YOLO_INPUT_SIZE
  const float32 = new Float32Array(3 * size)
  for (let i = 0; i < size; i++) {
    float32[i] = data[i * 3] / 255.0
    float32[size + i] = data[i * 3 + 1] / 255.0
    float32[2 * size + i] = data[i * 3 + 2] / 255.0
  }

  const inputTensor = new ort.Tensor('float32', float32, [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE])
  const results = await session.run({ [session.inputNames[0]]: inputTensor })
  const output = results[session.outputNames[0]]
  const out = output.data as Float32Array
  const numDetections = output.dims[2] // 8400
  const numClasses = output.dims[1] - 4 // 18

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

  // Collect detections above threshold
  const boxes: number[][] = []
  const scores: number[] = []
  const classIds: number[] = []

  for (let i = 0; i < numDetections; i++) {
    let maxScore = 0
    let maxClass = 0
    for (let c = 0; c < numClasses; c++) {
      const s = sigmoid(out[(4 + c) * numDetections + i])
      if (s > maxScore) { maxScore = s; maxClass = c }
    }
    if (maxScore >= YOLO_CONF) {
      const cx = out[i]
      const cy = out[numDetections + i]
      const w = out[2 * numDetections + i]
      const h = out[3 * numDetections + i]
      boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
      scores.push(maxScore)
      classIds.push(maxClass)
    }
  }

  if (boxes.length === 0) return false

  // NMS
  const keep = nms(boxes, scores, YOLO_IOU)

  // Check if any kept detection is NSFW or SEXY
  for (const idx of keep) {
    if (YOLO_NSFW_CLASSES.has(classIds[idx]) || YOLO_SEXY_CLASSES.has(classIds[idx])) {
      return true
    }
  }
  return false
}

/** Simple NMS implementation */
function nms(boxes: number[][], scores: number[], iouThreshold: number): number[] {
  const indices = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
  const keep: number[] = []
  const suppressed = new Set<number>()
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

function computeIoU(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter + 1e-6)
}

/**
 * Manually set the NSFW status of an image.
 */
export function setImageNsfwStatus(
  imageId: string,
  status: 'safe' | 'nsfw'
): void {
  const db = getDb()
  db.update(images)
    .set({
      nsfwStatus: status,
      nsfwScore: status === 'nsfw' ? 1000 : 0,
      updatedAt: Date.now()
    })
    .where(eq(images.id, imageId))
    .run()
}

/**
 * Batch set NSFW status for multiple images.
 */
export function batchSetNsfwStatus(
  imageIds: string[],
  status: 'safe' | 'nsfw'
): void {
  const db = getDb()
  for (const id of imageIds) {
    db.update(images)
      .set({
        nsfwStatus: status,
        nsfwScore: status === 'nsfw' ? 1000 : 0,
        updatedAt: Date.now()
      })
      .where(eq(images.id, id))
      .run()
  }
}

/**
 * Clear all NSFW scan results, resetting images to unscanned state.
 */
export function clearNsfwResults(): void {
  const db = getDb()
  db.update(images)
    .set({ nsfwScore: null, nsfwStatus: 'pending', updatedAt: Date.now() })
    .run()
}
