import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash'

export interface ThumbHashResult {
  hash: Uint8Array
  base64: string
  dataURL: string
  width: number
  height: number
  originalSize: number
}

export async function calculateThumbHash(file: File): Promise<ThumbHashResult> {
  return new Promise((resolve, reject) => {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      reject(new Error('文件必须是图片格式'))
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          // 创建 canvas 来处理图片
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('无法创建 Canvas 上下文'))
            return
          }

          // 调整图片尺寸以优化 ThumbHash 性能（最大 100x100）
          const maxSize = 100
          let { width, height } = img

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          // 设置 canvas 尺寸并绘制图片
          canvas.width = Math.round(width)
          canvas.height = Math.round(height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          // 获取图片数据
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

          // 生成 ThumbHash
          const hash = rgbaToThumbHash(
            canvas.width,
            canvas.height,
            imageData.data,
          )

          // 转换为 Base64 字符串
          const base64 = btoa(String.fromCharCode(...hash))

          // 生成 ThumbHash 预览图
          const dataURL = thumbHashToDataURL(hash)

          // 返回结果
          resolve({
            hash,
            base64,
            dataURL,
            width: canvas.width,
            height: canvas.height,
            originalSize: file.size,
          })
        } catch (error) {
          reject(
            new Error(
              `ThumbHash 计算失败: ${
                error instanceof Error ? error.message : '未知错误'
              }`,
            ),
          )
        }
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

// 辅助函数：将 ThumbHash 转换为不同格式
export function thumbHashToHex(hash: Uint8Array): string {
  return Array.from(hash)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// 辅助函数：从 Base64 恢复 ThumbHash
export function base64ToThumbHash(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// 辅助函数：获取压缩比信息
export function getCompressionInfo(originalSize: number, hashSize: number) {
  const compressionRatio = originalSize / hashSize
  const compressionPercentage = ((originalSize - hashSize) / originalSize) * 100

  return {
    originalSize,
    hashSize,
    compressionRatio: Math.round(compressionRatio),
    compressionPercentage: Math.round(compressionPercentage * 100) / 100,
  }
}
