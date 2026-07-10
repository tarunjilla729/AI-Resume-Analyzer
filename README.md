# AI Resume Analyzer

A full-stack application that:
- Extracts text from a user-uploaded **PDF** or **DOCX** resume
- Extracts **technical skills** from a job description (Groq)
- Computes an **ATS-like score deterministically in Python** by matching extracted skills against the resume text
- Uses AI only for coaching (interview questions, mastery plan, and rewrite suggestions)

## Architecture
- **Backend**: FastAPI (`backend/main.py`)
  - `POST /upload_resume` → extracts resume text
  - `POST /analyze` → computes score + deterministic skill matching, then generates coaching
- **Frontend**: Next.js (`frontend/app/page.tsx`)
  - UI calls Next.js route handlers that proxy to the backend

## Local Setup

### 1) Backend
1. Create a Python virtual environment (recommended).
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Add backend environment variables:
   - Create `backend/.env` with:
     ```bash
     GROQ_API_KEY=your_groq_key
     CORS_ORIGIN=http://localhost:3000
     MAX_UPLOAD_BYTES=5242880
     ```
4. Run the backend:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

### 2) Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm ci
   ```
2. Run dev server:
   ```bash
   npm run dev
   ```

Open: http://localhost:3000

## Render Deployment
This repo includes `render.yaml` and a repo-root `runtime.txt`.

Set environment variables on Render for the backend service:
- `GROQ_API_KEY`
- `CORS_ORIGIN` (optional; defaults to `*`)
- `MAX_UPLOAD_BYTES` (optional; defaults to 5MB)

The frontend is configured with:
- `NEXT_PUBLIC_API_BASE_URL=https://ai-resume-analyzer-backend.onrender.com`

## API Notes
- Uploads are limited by `MAX_UPLOAD_BYTES`.
- Only `.pdf` and `.docx` are supported.

## Security Notes
- Do not commit secrets to Git.
- Backend uses `.env` loading locally; Render injects secrets as environment variables.

