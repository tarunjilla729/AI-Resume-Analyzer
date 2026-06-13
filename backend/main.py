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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


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
    groq_client = _require_groq_client()
    resume_text_lower = (data.resume_text or "").lower()

    try:
        jd_prompt = f"""
Extract ONLY technical skills from this job description.

Rules:
- Return valid JSON only
- No markdown
- No explanations
- No soft skills
- No communication skills
- No teamwork
- No problem solving
- No generic words
- Keep exact technical skill names

Examples:
GOOD:
Python
FastAPI
TensorFlow
PyTorch
Docker
AWS
SQL
NLP
Machine Learning
Generative AI
LLMs
React
Git

BAD:
Knowledge
Experience
Technology
Learning
Problem Solving
Communication

Return format:
{{
  "skills": []
}}

Job Description:
{data.job_description}
"""

        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": jd_prompt}],
            temperature=0.2,
        )

        jd_ai_response = completion.choices[0].message.content or ""
        jd_parsed = _extract_first_json_object(jd_ai_response)
        jd_skills_raw = jd_parsed.get("skills", [])
        jd_skills = [skill.strip() for skill in jd_skills_raw if isinstance(skill, str) and skill.strip()]

        matched_skills = []
        for skill in jd_skills:
            if re.search(_skill_pattern(skill), resume_text_lower):
                matched_skills.append(skill)

        missing_skills = [skill for skill in jd_skills if skill not in matched_skills]
        score = int((len(matched_skills) / len(jd_skills)) * 100) if jd_skills else 0

        coaching_prompt = f"""
You are a career coach.
Do NOT invent new skills.
Use ONLY the provided skills lists.

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

Matched Skills: {matched_skills}
Missing Skills: {missing_skills}
ATS Score: {score}
"""

        coaching_completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": coaching_prompt}],
            temperature=0.2,
        )

        coaching_response = coaching_completion.choices[0].message.content or ""
        parsed = _extract_first_json_object(coaching_response)
        feedback = _ensure_feedback_schema(parsed, matched_skills, missing_skills)

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
