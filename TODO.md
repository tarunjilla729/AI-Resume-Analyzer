# TODO

## Completed
- [x] Repo-root `runtime.txt` + `render.yaml` validated for consistent Python selection on Render.
- [x] Hardened backend ATS scoring to be deterministic in Python.
- [x] Added upload size limit via `MAX_UPLOAD_BYTES`.
- [x] Added configurable CORS via `CORS_ORIGIN`.
- [x] Ensured repo ignores artifacts via root `.gitignore`.
- [x] Added missing root `README.md`.

## Remaining (if you want to be extra strict)
- [ ] Run `npm ci && npm run build` inside `frontend/` locally and verify.
- [ ] Run backend lint/type checks (optional) and add a basic health endpoint check.
- [ ] Confirm Render environment variables are set in the Render dashboard.

