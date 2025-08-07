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

import {
  FileMetadata,
  formatBytes,
  useFileUpload,
} from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import { calculateThumbHash } from "@/lib/thumbhash-utils";
import {
  deleMediaByEntryId,
  insertMediaToEntry,
} from "@/lib/dashboard/images/upimageData";
import { vidassociationGet } from "@/lib/dashboard/dataManagement/dataGet";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/animate-ui/radix/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type DataTy = Awaited<ReturnType<typeof vidassociationGet>>;

export default function Component({ datas }: { datas: DataTy }) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const maxSizeMB = 500;
  const maxSize = maxSizeMB * 1024 * 1024; // 5MB default
  const maxFiles = 6;

  // [x] 图片上传模块的文件预览及使用的签名逻辑完善

  const initialFiles = datas?.othermeidia.map((item) => ({
    id: Number(item.mediadata!.id),
    name: item.mediadata!.name,
    thumb_hash: item.mediadata!.thumb_hash,
    type: item.mediadata!.type,
    media_url: `http://localhost:5244/p/upload/${item.mediadata?.name}`,
    Hash: item.mediadata!.hash,
    size: Number(item.mediadata!.size),
  }));

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
      apiUrl: "/dashboard/api/proxy-upload",
      basePath: "/upload",
      asTask: true,
    },
  });

  const handleValueChange = async (value: string) => {
    console.log("选项输出", value);

    setSelectedValue(value);
  };

  files.forEach(async (f) => {
    if (f.uploadStatus === "success") {
      if (f.file instanceof File) {
        const buffer = await f.file.arrayBuffer();
        // 计算 SHA-256 哈希值
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const shaHex = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // [x] 图片 ThumbHash 记录逻辑
        const thumbHashResult = await calculateThumbHash(f.file);
        await insertMediaToEntry(
          Number(datas!.id),
          {
            name: f.file.name,
            type: f.file.type,
            thumb_hash: thumbHashResult.base64,
            hash: shaHex,
            size: BigInt(f.file.size),
          },
          0,
          f.id === selectedValue // cover 判断
        );
      }
    } else if (f.uploadStatus === "error") {
      console.error("上传失败", f.uploadError);
    }
  });
  // [ ] 是否为封面图片的逻辑
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
          <RadioGroup value={selectedValue} onValueChange={handleValueChange}>
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

                    {/* 是否为封面 */}
                    <div className="flex items-center">
                      <p className="text-muted-foreground text-xs">
                        {formatBytes(file.file.size)}
                      </p>
                      <div className="flex items-center">
                        <RadioGroupItem value={file.id} />
                        <Label>封面 ?</Label>
                      </div>
                    </div>

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
                      type="button"
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
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                    onClick={async () => {
                      if ("thumb_hash" in file.file && file.file.thumb_hash) {
                        const f = file.file as FileMetadata;
                        await deleMediaByEntryId(
                          Number(datas!.id),
                          f.id,
                          f.name
                        );
                      }
                      removeFile(file.id);
                    }}
                    aria-label="Remove file"
                    disabled={file.uploadStatus === "uploading"}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </RadioGroup>
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
