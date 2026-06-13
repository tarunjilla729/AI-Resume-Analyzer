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
  const payload = await request.text();
  const result = await proxyBackend("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
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
