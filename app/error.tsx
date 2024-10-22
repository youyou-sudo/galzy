"use client";
import Errors from "@/components/error";

export default function Error() {
  return (
    <div className="max-w-3xl mx-auto my-auto">
      <Errors code="400" />
    </div>
  );
}
