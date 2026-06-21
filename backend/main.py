from io import BytesIO
import json
import os
import re
from typing import Any

import fitz  # PyMuPDF
from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel


load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="AI Resume Analyzer")

cors_origin = os.getenv("CORS_ORIGIN", "*")
if cors_origin == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in cors_origin.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))


def _normalize_skill(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _unique_preserve_order(items: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for x in items:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _extract_jd_skills_with_groq(job_description: str) -> list[str]:
    groq_client = _require_groq_client()

    jd_prompt = f"""
Extract ONLY technical skills from this job description.

Rules:
- Return valid JSON only
- No markdown
- No explanations
- Keep exact technical skill names
- Output should be a de-duplicated list

Return format:
{{"skills": []}}

Job Description:
{job_description}
"""

    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": jd_prompt}],
        temperature=0.1,
    )

    jd_ai_response = completion.choices[0].message.content or ""
    jd_parsed = _extract_first_json_object(jd_ai_response)
    raw = jd_parsed.get("skills", [])
    skills = [
        _normalize_skill(skill)
        for skill in raw
        if isinstance(skill, str) and _normalize_skill(skill)
    ]
    return _unique_preserve_order(skills)


class ResumeRequest(BaseModel):
    resume_text: str
    job_description: str


@app.get("/")
def root():
    return {"message": "AI Resume Analyzer Backend Running"}


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_first_json_object(text: str) -> dict[str, Any]:
    """Best-effort extraction of the first JSON object from a model response."""
    if not text:
        return {}

    cleaned = _strip_code_fences(text)

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = cleaned[start : end + 1]
        try:
            parsed = json.loads(snippet)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            pass

    return {}


def _empty_feedback(message: str) -> dict[str, Any]:
    return {
        "strengthsSentence": message,
        "skillsPresent": [],
        "skillsMissing": [],
        "skillsPresentSentence": "",
        "skillsMissingSentence": "",
        "interviewQuestions": [],
        "recommendedProjects": [],
        "resumeRewriteSuggestions": [],
        "masterySuggestions": {"overallPlan": [], "missingSkillMastery": {}},
        "finalRecommendation": message,
    }


def _ensure_feedback_schema(
    feedback: dict[str, Any], matched_skills: list[str], missing_skills: list[str]
) -> dict[str, Any]:
    feedback.setdefault("strengthsSentence", "")
    feedback.setdefault("skillsPresent", matched_skills)
    feedback.setdefault("skillsMissing", missing_skills)
    feedback.setdefault("skillsPresentSentence", "")
    feedback.setdefault("skillsMissingSentence", "")
    feedback.setdefault("interviewQuestions", [])
    feedback.setdefault("recommendedProjects", [])
    feedback.setdefault("resumeRewriteSuggestions", [])
    feedback.setdefault("masterySuggestions", {"overallPlan": [], "missingSkillMastery": {}})
    feedback.setdefault("finalRecommendation", "")
    return feedback


def _extract_docx_text(content: bytes) -> str:
    doc = Document(BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs if para.text)


def _extract_pdf_text(content: bytes) -> str:
    extracted_text = ""
    with fitz.open(stream=content, filetype="pdf") as pdf:
        for page in pdf:
            extracted_text += page.get_text() or ""
    return extracted_text


def _skill_pattern(skill: str) -> str:
    escaped = re.escape(skill.lower())
    return rf"(?<![\w.+#-]){escaped}(?![\w.+#-])"


def _require_groq_client() -> Groq:
    if client is None:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured. Add it to backend/.env.",
        )
    return client


@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    filename_lower = file.filename.lower()
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max allowed is {MAX_UPLOAD_BYTES} bytes.",
        )


    try:
        if filename_lower.endswith(".pdf"):
            extracted_text = _extract_pdf_text(content)
        elif filename_lower.endswith(".docx"):
            extracted_text = _extract_docx_text(content)
        else:
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not extract resume text: {exc}") from exc

    if not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text was found. If this is a scanned resume, convert it with OCR first.",
        )

    return {"resume_text": extracted_text}


@app.post("/analyze")
async def analyze_resume(data: ResumeRequest):
    _ = _require_groq_client()  # ensure key present early
    resume_text_lower = (data.resume_text or "").lower()

    try:
        jd_skills = _extract_jd_skills_with_groq(data.job_description)

        # Deterministic filtering: only keep skills that truly appear in resume text.
        matched_skills: list[str] = []
        for skill in jd_skills:
            if re.search(_skill_pattern(skill), resume_text_lower):
                matched_skills.append(skill)

        missing_skills: list[str] = [s for s in jd_skills if s not in matched_skills]


        score = int((len(matched_skills) / len(jd_skills)) * 100) if jd_skills else 0


        # Coaching: explicitly forbid new skills; the model can only comment on provided skills.
        coaching_prompt = f"""
You are a career coach.
You MUST NOT invent any new skills.
Use ONLY these arrays exactly as provided.

Return JSON only with this exact schema:
{{
  "strengthsSentence": "string",
  "skillsPresent": ["skill"],
  "skillsMissing": ["skill"],
  "skillsPresentSentence": "string",
  "skillsMissingSentence": "string",
  "interviewQuestions": ["question"],
  "recommendedProjects": ["project"],
  "resumeRewriteSuggestions": ["suggestion"],
  "masterySuggestions": {{
    "overallPlan": ["step"],
    "missingSkillMastery": {{
      "Skill Name": ["step1", "step2", "step3"]
    }}
  }},
  "finalRecommendation": "string"
}}

skillsPresent MUST equal: {matched_skills}
skillsMissing MUST equal: {missing_skills}
ATS Score MUST equal: {score}
"""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": coaching_prompt}],
            temperature=0.2,
        )

        coaching_response = completion.choices[0].message.content or ""
        parsed = _extract_first_json_object(coaching_response)
        feedback = _ensure_feedback_schema(parsed, matched_skills, missing_skills)

        # Final guardrail: overwrite hallucinated fields with deterministic ones.
        feedback["skillsPresent"] = matched_skills
        feedback["skillsMissing"] = missing_skills

        return {
            "score": score,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "ai_feedback": feedback,
        }
    except HTTPException:
        raise
    except Exception as exc:
        return {
            "score": 0,
            "matched_skills": [],
            "missing_skills": [],
            "ai_feedback": _empty_feedback(f"Error: {exc}"),
        }

