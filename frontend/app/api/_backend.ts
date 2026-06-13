const backendCandidates = Array.from(
  new Set(
    [
      process.env.API_BASE_URL,
      process.env.NEXT_PUBLIC_API_BASE_URL,
      "http://127.0.0.1:8001",
      "http://127.0.0.1:8000",
    ]
      .filter(Boolean)
      .map((url) => url!.replace(/\/$/, ""))
  )
);

export async function findBackend() {
  for (const baseUrl of backendCandidates) {
    try {
      const response = await fetch(`${baseUrl}/`, { cache: "no-store" });
      if (response.ok) return baseUrl;
    } catch {
      // Try the next local backend candidate.
    }
  }

  return null;
}

export async function proxyBackend(path: string, init?: RequestInit) {
  let lastError = "Backend is not reachable.";

  for (const baseUrl of backendCandidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (response.ok) {
        return { response, baseUrl };
      }

      lastError = await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Backend request failed.";
    }
  }

  return { error: lastError };
}
