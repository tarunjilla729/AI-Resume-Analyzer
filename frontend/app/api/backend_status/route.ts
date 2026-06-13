import { NextResponse } from "next/server";
import { findBackend } from "../_backend";

export async function GET() {
  const baseUrl = await findBackend();

  if (!baseUrl) {
    return NextResponse.json(
      { status: "offline", backend: null },
      { status: 503 }
    );
  }

  return NextResponse.json({ status: "online", backend: baseUrl });
}
