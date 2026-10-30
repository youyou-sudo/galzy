/**
 * 最小 PNG 编解码（只支持 8bit / 非隔行），用于 diff 工具。
 * 使用 Node zlib（Bun 自带 node:zlib 兼容层）；Bun.inflateSync 在
 * 大体积多 IDAT 的 PNG 上会报 "invalid stored block lengths"，故不用它。
 */
import { deflateSync, inflateSync } from 'node:zlib'

export type DecodedPng = {
  width: number
  height: number
  /** RGBA，每像素 4 字节 */
  data: Uint8Array
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  )
}

function writeU32(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >>> 24) & 0xff
  out[offset + 1] = (value >>> 16) & 0xff
  out[offset + 2] = (value >>> 8) & 0xff
  out[offset + 3] = value & 0xff
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** 解码 PNG 为 RGBA。 */
export function decodePng(bytes: Uint8Array): DecodedPng {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('不是 PNG 文件')
  }
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 8
  let colorType = 6
  let interlace = 0
  const idatParts: Uint8Array[] = []

  while (offset < bytes.length) {
    const length = readU32(bytes, offset)
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    )
    const dataStart = offset + 8
    const data = bytes.subarray(dataStart, dataStart + length)
    if (type === 'IHDR') {
      width = readU32(data, 0)
      height = readU32(data, 4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset = dataStart + length + 4
  }

  if (interlace !== 0) throw new Error('不支持隔行 PNG')
  if (bitDepth !== 8) throw new Error('不支持 bitDepth=' + bitDepth + ' 的 PNG')

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1
  const total = idatParts.reduce((sum, part) => sum + part.length, 0)
  const compressed = new Uint8Array(total)
  let cursor = 0
  for (const part of idatParts) {
    compressed.set(part, cursor)
    cursor += part.length
  }
  const raw = new Uint8Array(inflateSync(compressed))
  const stride = width * channels
  const out = new Uint8Array(width * height * 4)
  let prev = new Uint8Array(stride)
  let current = new Uint8Array(stride)
  let rawOffset = 0

  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++]
    current = raw.subarray(rawOffset, rawOffset + stride)
    rawOffset += stride
    // 原地反滤波（current 是 raw 的视图，可直接写）
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? current[x - channels] : 0
      const up = prev[x]
      const upLeft = x >= channels ? prev[x - channels] : 0
      let value = current[x]
      switch (filter) {
        case 0:
          break
        case 1:
          value = (value + left) & 0xff
          break
        case 2:
          value = (value + up) & 0xff
          break
        case 3:
          value = (value + ((left + up) >> 1)) & 0xff
          break
        case 4:
          value = (value + paeth(left, up, upLeft)) & 0xff
          break
        default:
          throw new Error('未知 PNG filter: ' + filter)
      }
      current[x] = value
    }
    // current 已经是「本行」的视图，索引从 0 开始（不要再叠加 y*stride）
    for (let x = 0; x < width; x++) {
      const src = x * channels
      const dst = (y * width + x) * 4
      out[dst] = current[src]
      out[dst + 1] = current[src + 1] ?? current[src]
      out[dst + 2] = current[src + 2] ?? current[src]
      out[dst + 3] = channels === 4 ? current[src + 3] : channels === 2 ? current[src + 1] : 255
    }
    prev = current
  }

  return { width, height, data: out }
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  writeU32(out, 0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  const crcInput = out.subarray(4, 8 + data.length)
  writeU32(out, 8 + data.length, crc32(crcInput))
  return out
}

/** 把 RGBA 编码为 PNG。 */
export function encodePng(image: DecodedPng): Uint8Array {
  const { width, height, data } = image
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(data.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1)
  }
  const compressed = new Uint8Array(deflateSync(raw))
  const ihdr = new Uint8Array(13)
  writeU32(ihdr, 0, width)
  writeU32(ihdr, 4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const parts = [
    Uint8Array.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

export type PixelDiff = {
  diffPixels: number
  totalPixels: number
  diffRatio: number
  meanDelta: number
  sizeMismatch: boolean
  widthA: number
  heightA: number
  widthB: number
  heightB: number
}

/**
 * 逐像素比较两张图。
 * 尺寸不同时按最大尺寸对齐，缺失区域记为差异。
 */
export function diffImages(
  a: DecodedPng,
  b: DecodedPng,
  tolerance = 8,
): { stats: PixelDiff; diff: DecodedPng } {
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)
  const out = new Uint8Array(width * height * 4)
  let diffPixels = 0
  let deltaSum = 0
  const sizeMismatch = a.width !== b.width || a.height !== b.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4
      const insideA = x < a.width && y < a.height
      const insideB = x < b.width && y < b.height
      const aOffset = insideA ? (y * a.width + x) * 4 : -1
      const bOffset = insideB ? (y * b.width + x) * 4 : -1
      const ar = aOffset >= 0 ? a.data[aOffset] : 0
      const ag = aOffset >= 0 ? a.data[aOffset + 1] : 0
      const ab = aOffset >= 0 ? a.data[aOffset + 2] : 0
      const aa = aOffset >= 0 ? a.data[aOffset + 3] : 0
      const br = bOffset >= 0 ? b.data[bOffset] : 0
      const bg = bOffset >= 0 ? b.data[bOffset + 1] : 0
      const bb = bOffset >= 0 ? b.data[bOffset + 2] : 0

      const delta = Math.max(
        Math.abs(ar - br),
        Math.abs(ag - bg),
        Math.abs(ab - bb),
        insideA === insideB ? 0 : 255,
      )
      deltaSum += delta
      const changed = delta > tolerance || !insideA || !insideB
      if (changed) diffPixels++

      if (changed) {
        out[dst] = 255
        out[dst + 1] = 0
        out[dst + 2] = 0
        out[dst + 3] = 255
      } else {
        // 淡化原图，便于定位
        out[dst] = Math.round(ar * 0.35 + 255 * 0.65)
        out[dst + 1] = Math.round(ag * 0.35 + 255 * 0.65)
        out[dst + 2] = Math.round(ab * 0.35 + 255 * 0.65)
        out[dst + 3] = 255
      }
    }
  }

  const totalPixels = width * height
  return {
    stats: {
      diffPixels,
      totalPixels,
      diffRatio: totalPixels === 0 ? 0 : diffPixels / totalPixels,
      meanDelta: totalPixels === 0 ? 0 : deltaSum / totalPixels,
      sizeMismatch,
      widthA: a.width,
      heightA: a.height,
      widthB: b.width,
      heightB: b.height,
    },
    diff: { width, height, data: out },
  }
}
