"use client";
import Errors from "@/components/error";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="max-w-3xl mx-auto my-auto">
      <Errors
        code="400"
        errormessage={
          error?.message ||
          (typeof error === "object"
            ? Object.keys(error).join(", ")
            : String(error))
        }
      />
    </div>
  );
}
