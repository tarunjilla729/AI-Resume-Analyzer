import { NextResponse } from "next/server";
import { proxyBackend } from "../_backend";

function cleanError(error: string) {
  try {
    const parsed = JSON.parse(error);
    return parsed.detail || parsed.error || error;
  } catch {
    return error;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await proxyBackend("/upload_resume", {
    method: "POST",
    body: formData,
  });

  if ("error" in result) {
    return NextResponse.json(
      { detail: cleanError(result.error || "Backend is not reachable.") },
      { status: 502 }
    );
  }

  const data = await result.response.json();
  return NextResponse.json(data, {
    status: result.response.status,
    headers: { "x-backend-url": result.baseUrl },
  });
}
