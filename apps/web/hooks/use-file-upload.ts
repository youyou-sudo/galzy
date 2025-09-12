'use client'

import type React from 'react'

import {
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

export type FileMetadata = {
  id: number
  name: string
  thumb_hash: string | null
  type: string
  media_url: string
  Hash: string
  size: number
  cover: boolean
}

export type FileWithPreview = {
  id: string
  file: FileMetadata | File
  cover: boolean
  preview?: string
  uploadProgress?: number
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error'
  uploadError?: string
}

export type FileUploadOptions = {
  maxFiles?: number
  maxSize?: number
  accept?: string
  multiple?: boolean
  initialFiles?: FileMetadata[]
  onFilesChange?: (files: FileWithPreview[]) => void
  onFilesAdded?: (addedFiles: FileWithPreview[]) => void
  onAllUploadsComplete?: () => void
  uploadConfig?: {
    apiUrl: string
    authorization?: string
    basePath?: string
    asTask?: boolean
  }
}

export type FileUploadState = {
  files: FileWithPreview[]
  isDragging: boolean
  errors: string[]

  isAllUploadsComplete: boolean // 新增：是否所有上传都完成
  hasPendingUploads: boolean // 新增
}

export type FileUploadActions = {
  addFiles: (files: FileList | File[]) => void
  removeFile: (id: string) => void
  clearFiles: () => void
  clearErrors: () => void
  handleDragEnter: (e: DragEvent<HTMLElement>) => void
  handleDragLeave: (e: DragEvent<HTMLElement>) => void
  handleDragOver: (e: DragEvent<HTMLElement>) => void
  handleDrop: (e: DragEvent<HTMLElement>) => void
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  openFileDialog: () => void
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>,
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>
  }
  // 新增上传方法
  uploadFile: (id: string) => Promise<void>
  uploadAllFiles: () => Promise<void>
  retryUpload: (id: string) => Promise<void>
}

export const useFileUpload = (
  options: FileUploadOptions = {},
): [FileUploadState, FileUploadActions] => {
  const {
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    accept = '*',
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
    onAllUploadsComplete,
    uploadConfig = {
      apiUrl: '',
      basePath: '/uploads',
      asTask: false,
    },
  } = options

  const [state, setState] = useState<FileUploadState>({
    files: initialFiles.map((file) => ({
      id: file.Hash,
      preview: file.media_url,
      file,
      cover: file.cover,
    })),
    isDragging: false,
    errors: [],
    isAllUploadsComplete: false,
    hasPendingUploads: false,
  })

  const inputRef = useRef<HTMLInputElement>(null)

  // 检查上传状态的辅助函数
  const checkUploadStatus = useCallback((files: FileWithPreview[]) => {
    const fileFiles = files.filter((f) => f.file instanceof File)

    if (fileFiles.length === 0) {
      return {
        hasPendingUploads: false,
        isAllUploadsComplete: false,
      }
    }

    const pendingFiles = fileFiles.filter(
      (f) =>
        !f.uploadStatus ||
        f.uploadStatus === 'pending' ||
        f.uploadStatus === 'error',
    )
    const uploadingFiles = fileFiles.filter(
      (f) => f.uploadStatus === 'uploading',
    )
    const successFiles = fileFiles.filter((f) => f.uploadStatus === 'success')

    const hasPendingUploads =
      pendingFiles.length > 0 || uploadingFiles.length > 0
    const isAllUploadsComplete =
      fileFiles.length > 0 && successFiles.length === fileFiles.length

    return {
      hasPendingUploads,
      isAllUploadsComplete,
    }
  }, [])

  // 监听文件状态变化，检查是否所有上传都完成
  useEffect(() => {
    const { hasPendingUploads, isAllUploadsComplete } = checkUploadStatus(
      state.files,
    )

    // 如果状态发生变化，更新state
    if (
      state.hasPendingUploads !== hasPendingUploads ||
      state.isAllUploadsComplete !== isAllUploadsComplete
    ) {
      setState((prev) => ({
        ...prev,
        hasPendingUploads,
        isAllUploadsComplete,
      }))

      // 如果所有上传都完成了，并且之前不是完成状态，调用回调
      if (
        isAllUploadsComplete &&
        !state.isAllUploadsComplete &&
        onAllUploadsComplete
      ) {
        onAllUploadsComplete()
      }
    }
  }, [
    state.files,
    state.hasPendingUploads,
    state.isAllUploadsComplete,
    checkUploadStatus,
    onAllUploadsComplete,
  ])

  const validateFile = useCallback(
    (file: File | FileMetadata): string | null => {
      if (file instanceof File) {
        if (file.size > maxSize) {
          return `File "${file.name}" exceeds the maximum size of ${formatBytes(
            maxSize,
          )}.`
        }
      } else {
        if (file.size > maxSize) {
          return `File "${file.name}" exceeds the maximum size of ${formatBytes(
            maxSize,
          )}.`
        }
      }

      if (accept !== '*') {
        const acceptedTypes = accept.split(',').map((type) => type.trim())
        const fileType = file instanceof File ? file.type || '' : file.type
        const fileExtension = `.${
          file instanceof File
            ? file.name.split('.').pop()
            : file.name.split('.').pop()
        }`

        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith('.')) {
            return fileExtension.toLowerCase() === type.toLowerCase()
          }
          if (type.endsWith('/*')) {
            const baseType = type.split('/')[0]
            return fileType.startsWith(`${baseType}/`)
          }
          return fileType === type
        })

        if (!isAccepted) {
          return `File "${
            file instanceof File ? file.name : file.name
          }" is not an accepted file type.`
        }
      }

      return null
    },
    [accept, maxSize],
  )

  const createPreview = useCallback(
    (file: File | FileMetadata): string | undefined => {
      if (file instanceof File) {
        // 对于视频文件，不创建预览URL以节省内存
        if (file.type.startsWith('video/')) {
          return undefined
        }
        return URL.createObjectURL(file)
      }
      return file.media_url
    },
    [],
  )

  const generateUniqueId = useCallback(
    async (file: File | FileMetadata): Promise<string> => {
      if (file instanceof File) {
        // 读取文件内容为 ArrayBuffer
        const buffer = await file.arrayBuffer()

        // 计算 SHA-256 哈希
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)

        // 转为 16 进制字符串
        const shaHex = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        return shaHex
      }

      // 如果是 FileMetadata 类型，直接返回已有的 Hash
      return file.Hash
    },
    [],
  )

  const clearFiles = useCallback(() => {
    setState((prev) => {
      // Clean up object URLs for images
      prev.files.forEach((file) => {
        if (
          file.preview &&
          file.file instanceof File &&
          file.file.type.startsWith('image/')
        ) {
          URL.revokeObjectURL(file.preview)
        }
      })

      if (inputRef.current) {
        inputRef.current.value = ''
      }

      const newState = {
        ...prev,
        files: [],
        errors: [],
        hasPendingUploads: false,
        isAllUploadsComplete: false,
      }

      onFilesChange?.(newState.files)
      return newState
    })
  }, [onFilesChange])
  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      if (!newFiles || newFiles.length === 0) return

      const newFilesArray = Array.from(newFiles)
      const errors: string[] = []

      setState((prev) => ({ ...prev, errors: [] }))

      if (!multiple) {
        clearFiles()
      }

      if (
        multiple &&
        maxFiles !== Number.POSITIVE_INFINITY &&
        state.files.length + newFilesArray.length > maxFiles
      ) {
        errors.push(`You can only upload a maximum of ${maxFiles} files.`)
        setState((prev) => ({ ...prev, errors }))
        return
      }

      const validFiles: FileWithPreview[] = []

      for (const file of newFilesArray) {
        if (multiple) {
          const isDuplicate = state.files.some(
            (existingFile) =>
              existingFile.file.name === file.name &&
              existingFile.file.size === file.size,
          )

          if (isDuplicate) {
            continue // 跳过重复文件
          }
        }

        if (file.size > maxSize) {
          errors.push(
            multiple
              ? `Some files exceed the maximum size of ${formatBytes(maxSize)}.`
              : `File exceeds the maximum size of ${formatBytes(maxSize)}.`,
          )
          continue
        }

        const error = validateFile(file)
        if (error) {
          errors.push(error)
          continue
        }

        // 这里等待异步生成 id
        const id = await generateUniqueId(file)

        validFiles.push({
          file,
          cover: false,
          id, // 用刚刚计算好的 id
          preview: createPreview(file),
          uploadProgress: 0,
          uploadStatus: 'pending' as const,
        })
      }

      if (validFiles.length > 0) {
        onFilesAdded?.(validFiles)

        setState((prev) => {
          const newFiles = !multiple
            ? validFiles
            : [...prev.files, ...validFiles]
          onFilesChange?.(newFiles)
          return {
            ...prev,
            files: newFiles,
            errors,
            isAllUploadsComplete: false,
          }
        })
      } else if (errors.length > 0) {
        setState((prev) => ({
          ...prev,
          errors,
        }))
      }

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    [
      state.files,
      maxFiles,
      multiple,
      maxSize,
      validateFile,
      createPreview,
      generateUniqueId,
      clearFiles,
      onFilesChange,
      onFilesAdded,
    ],
  )

  const removeFile = useCallback(
    (id: string) => {
      setState((prev) => {
        const fileToRemove = prev.files.find((file) => file.id === id)
        if (
          fileToRemove?.preview &&
          fileToRemove.file instanceof File &&
          fileToRemove.file.type.startsWith('image/')
        ) {
          URL.revokeObjectURL(fileToRemove.preview)
        }

        const newFiles = prev.files.filter((file) => file.id !== id)
        onFilesChange?.(newFiles)

        return {
          ...prev,
          files: newFiles,
          errors: [],
        }
      })
    },
    [onFilesChange],
  )

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }))
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setState((prev) => ({ ...prev, isDragging: true }))
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }

    setState((prev) => ({ ...prev, isDragging: false }))
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setState((prev) => ({ ...prev, isDragging: false }))

      // Don't process files if the input is disabled
      if (inputRef.current?.disabled) {
        return
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // In single file mode, only use the first file
        if (!multiple) {
          const file = e.dataTransfer.files[0]
          addFiles([file])
        } else {
          addFiles(e.dataTransfer.files)
        }
      }
    },
    [addFiles, multiple],
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
      }
    },
    [addFiles],
  )

  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }, [])

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => {
      return {
        ...props,
        type: 'file' as const,
        onChange: handleFileChange,
        accept: props.accept || accept,
        multiple: props.multiple !== undefined ? props.multiple : multiple,
        ref: inputRef,
      }
    },
    [accept, multiple, handleFileChange],
  )

  // 上传方法
  const uploadFile = useCallback(
    async (id: string) => {
      const fileItem = state.files.find((f) => f.id === id)
      if (!fileItem || !(fileItem.file instanceof File)) return

      const file = fileItem.file

      // 更新状态为上传中
      setState((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === id
            ? {
                ...f,
                uploadStatus: 'uploading' as const,
                uploadProgress: 0,
                uploadError: undefined,
              }
            : f,
        ),
      }))

      try {
        const xhr = new XMLHttpRequest()
        return new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100)
              setState((prev) => ({
                ...prev,
                files: prev.files.map((f) =>
                  f.id === id ? { ...f, uploadProgress: progress } : f,
                ),
              }))
            }
          })

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setState((prev) => ({
                ...prev,
                files: prev.files.map((f) =>
                  f.id === id
                    ? {
                        ...f,
                        uploadStatus: 'success' as const,
                        uploadProgress: 100,
                      }
                    : f,
                ),
              }))
              resolve()
            } else {
              const error = `Upload failed: ${xhr.status} ${xhr.statusText}`
              setState((prev) => ({
                ...prev,
                files: prev.files.map((f) =>
                  f.id === id
                    ? {
                        ...f,
                        uploadStatus: 'error' as const,
                        uploadError: error,
                      }
                    : f,
                ),
              }))
              reject(new Error(error))
            }
          })

          xhr.addEventListener('error', () => {
            const error = 'Upload failed: Network error'
            setState((prev) => ({
              ...prev,
              files: prev.files.map((f) =>
                f.id === id
                  ? { ...f, uploadStatus: 'error' as const, uploadError: error }
                  : f,
              ),
            }))
            reject(new Error(error))
          })

          xhr.open('PUT', uploadConfig.apiUrl)

          // 设置请求头
          if (uploadConfig.authorization) {
            xhr.setRequestHeader('Authorization', uploadConfig.authorization)
          }

          const filePath = encodeURIComponent(
            `${uploadConfig.basePath || '/uploads'}/${file.name}`,
          )
          xhr.setRequestHeader('File-Path', filePath)
          xhr.setRequestHeader(
            'Content-Type',
            file.type || 'application/octet-stream',
          )

          if (uploadConfig.asTask) {
            xhr.setRequestHeader('As-Task', 'true')
          }

          xhr.send(file)
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed'
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === id
              ? {
                  ...f,
                  uploadStatus: 'error' as const,
                  uploadError: errorMessage,
                }
              : f,
          ),
        }))
        throw error
      }
    },
    [state.files, uploadConfig],
  )

  const uploadAllFiles = useCallback(async () => {
    const filesToUpload = state.files.filter(
      (f) =>
        f.file instanceof File &&
        (!f.uploadStatus ||
          f.uploadStatus === 'pending' ||
          f.uploadStatus === 'error'),
    )

    for (const file of filesToUpload) {
      try {
        await uploadFile(file.id)
      } catch (error) {
        console.error(`Failed to upload ${file.file.name}:`, error)
      }
    }
  }, [state.files, uploadFile])

  const retryUpload = useCallback(
    async (id: string) => {
      await uploadFile(id)
    },
    [uploadFile],
  )

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
      uploadFile,
      uploadAllFiles,
      retryUpload,
    },
  ]
}

// Helper function to format bytes to human-readable format
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i]
}
