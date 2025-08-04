// app/api/proxy-upload/route.ts
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest) {
  const body = req.body;
  if (!body) {
    return new Response("No file body", { status: 400 });
  }

  const targetUrl = "http://localhost:5244/api/fs/put";

  const headers = new Headers();
  const forwardedHeaders = req.headers;

  for (const [key, value] of forwardedHeaders.entries()) {
    if (
      ["authorization", "file-path", "content-type", "as-task"].includes(
        key.toLowerCase()
      )
    ) {
      headers.set(key, value);
    }
  }

  const upstreamRes = await fetch(targetUrl, {
    method: "PUT",
    headers,
    body,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    duplex: "half", // 关键：加上这个选项支持流式请求体
  });

  const resBody = await upstreamRes.arrayBuffer();

  return new Response(resBody, {
    status: upstreamRes.status,
    headers: {
      "Content-Type":
        upstreamRes.headers.get("Content-Type") || "application/octet-stream",
    },
  });
}
