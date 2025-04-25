import { Suspense } from "react";
import AuthForm from "@/app/(app)/(auth)/(components)/AuthForm";

export default async function page() {
  return (
    <div>
      <Suspense fallback={<div>加载中...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
