"use client";

import {
  AlertCircleIcon,
  ImageIcon,
  UploadIcon,
  XIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  PlayIcon,
} from "lucide-react";

import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import { calculateThumbHash } from "@/lib/thumbhash-utils";
import { insertMediaToEntry } from "@/lib/dashboard/images/upimageData";

// Create some dummy initial files
const initialFiles = [
  {
    name: "image-01.jpg",
    thumb_hash: "image-01-thumbhash",
    type: "image/jpeg",
    media_url: "https://picsum.photos/1000/800?grayscale&random=1",
    Hash: "image-01-123456789",
    Cover: 1,
    size: 1528737,
  },
];

export default function Component() {
  const maxSizeMB = 500;
  const maxSize = maxSizeMB * 1024 * 1024; // 5MB default
  const maxFiles = 6;
  const testId = 1;

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
      uploadFile,
      uploadAllFiles,
      retryUpload,
    },
  ] = useFileUpload({
    accept: "image/svg+xml,image/png,image/jpeg,image/jpg",
    maxSize,
    multiple: true,
    maxFiles,
    initialFiles,
    uploadConfig: {
      apiUrl: "/api/proxy-upload",
      authorization:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicHdkX3RzIjoxNzUzNzc1ODUwLCJleHAiOjE3NTM5NDg2NTYsIm5iZiI6MTc1Mzc3NTg1NiwiaWF0IjoxNzUzNzc1ODU2fQ.A1gFWzBHKG2OaF2op_yNrkIeCDdjc2FuX0reDfG74kA", // 用户需要替换为实际的token
      basePath: "/upload",
      asTask: true,
    },
  });

  files.forEach(async (f) => {
    if (f.uploadStatus === "success") {
      console.log("上传成功", f.file.name);
      if (f.file instanceof File) {
        const buffer = await f.file.arrayBuffer();
        // 计算 SHA-256 哈希值
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const shaHex = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        console.log(`SHA-256 Hash: ${shaHex}`);

        // [ ] 图片 ThumbHash 记录逻辑
        const thumbHashResult = await calculateThumbHash(f.file);
        await insertMediaToEntry(testId, {
          name: f.file.name,
          type: f.file.type,
          thumb_hash: thumbHashResult.base64,
          hash: shaHex,
          cover: 1,
          size: BigInt(f.file.size),
        });
      }
    } else if (f.uploadStatus === "error") {
      console.error("上传失败11", f.uploadError);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
      >
        <input
          {...getInputProps()}
          className="sr-only"
          aria-label="Upload image file"
        />
        <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
          <div
            className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
            aria-hidden="true"
          >
            <ImageIcon className="size-4 opacity-60" />
          </div>
          <p className="mb-1.5 text-sm font-medium">Drop your images here</p>
          <p className="text-muted-foreground text-xs">
            SVG, PNG, JPG or GIF (max. {maxSizeMB}MB)
          </p>
          <Button
            variant="outline"
            className="mt-4 bg-transparent"
            onClick={openFileDialog}
          >
            <UploadIcon className="-ms-1 opacity-60" aria-hidden="true" />
            Select images
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="text-destructive flex items-center gap-1 text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {/* Upload all button */}
          {files.some(
            (f) => f.uploadStatus === "pending" || f.uploadStatus === "error"
          ) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={uploadAllFiles}>
                <PlayIcon className="size-3" />
                Upload All
              </Button>
            </div>
          )}

          {files.map((file) => (
            <div
              key={file.id}
              className="bg-background flex items-center justify-between gap-2 rounded-lg border p-2 pe-3"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="bg-accent aspect-square shrink-0 rounded relative">
                  <img
                    src={file.preview || "/placeholder.svg"}
                    alt={file.file.name}
                    className="size-10 rounded-[inherit] object-cover"
                  />
                  {/* Status indicator */}
                  <div className="absolute -top-1 -right-1">
                    {file.uploadStatus === "success" && (
                      <div className="bg-green-500 text-white rounded-full p-0.5">
                        <CheckCircleIcon className="size-3" />
                      </div>
                    )}
                    {file.uploadStatus === "error" && (
                      <div className="bg-red-500 text-white rounded-full p-0.5">
                        <AlertCircleIcon className="size-3" />
                      </div>
                    )}
                    {file.uploadStatus === "uploading" && (
                      <div className="bg-blue-500 text-white rounded-full p-0.5 animate-spin">
                        <RefreshCwIcon className="size-3" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {file.file.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatBytes(file.file.size)}
                  </p>

                  {/* Progress bar */}
                  {file.uploadStatus === "uploading" &&
                    typeof file.uploadProgress === "number" && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${file.uploadProgress}%` }}
                        />
                      </div>
                    )}

                  {/* Error message */}
                  {file.uploadStatus === "error" && file.uploadError && (
                    <p className="text-red-500 text-xs truncate">
                      {file.uploadError}
                    </p>
                  )}

                  {/* Success message */}
                  {file.uploadStatus === "success" && (
                    <p className="text-green-500 text-xs">Upload completed</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Upload/Retry button */}
                {(file.uploadStatus === "pending" ||
                  file.uploadStatus === "error") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() =>
                      file.uploadStatus === "error"
                        ? retryUpload(file.id)
                        : uploadFile(file.id)
                    }
                    aria-label={
                      file.uploadStatus === "error"
                        ? "Retry upload"
                        : "Upload file"
                    }
                  >
                    {file.uploadStatus === "error" ? (
                      <RefreshCwIcon className="size-4" />
                    ) : (
                      <PlayIcon className="size-4" />
                    )}
                  </Button>
                )}

                {/* Remove button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                  onClick={() => removeFile(file.id)}
                  aria-label="Remove file"
                  disabled={file.uploadStatus === "uploading"}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        aria-live="polite"
        role="region"
        className="text-muted-foreground mt-2 text-center text-xs"
      >
        Multiple image uploader with streaming upload & progress ∙{" "}
        <a
          href="https://github.com/origin-space/originui/tree/main/docs/use-file-upload.md"
          className="hover:text-foreground underline"
        >
          API
        </a>
      </p>
    </div>
  );
}
