# AI Resume Analyzer - Deployment & Production Fixes

## Steps
- [ ] Create root `runtime.txt` to force Render Python version.
- [ ] Update backend `requirements.txt` with pinned compatible versions.
- [ ] Harden backend ATS logic to prevent Groq skill hallucinations:
  - deterministic JD-skill filtering
  - deterministic resume matching
  - use Groq only for coaching/recommendations
  - robust JSON parsing + safe fallbacks
- [x] Improve backend production readiness (upload size limits, CORS via env).

- [ ] Add/repair `.gitignore` at repo root (no venv/node_modules/.next/.env tracking).
- [ ] Add `render.yaml` with exact Root Directory / Build / Start / Env.
- [x] Verify backend + frontend local run instructions.

- [x] Produce final deployment report + checklist.


