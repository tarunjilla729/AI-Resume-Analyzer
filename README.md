# AI Resume Analyzer

An AI-powered web application that helps job seekers evaluate how well their resume matches a specific job description. Simply upload your resume, paste a job description, and the application generates an ATS score along with personalized feedback to help improve your chances of getting shortlisted.

---

## Live Demo

**Frontend:**  
https://ai-resume-analyzer-frontend-xz3l.onrender.com

**Backend API:**  
https://ai-resume-analyzer-1-mozg.onrender.com

**API Documentation:**  
https://ai-resume-analyzer-1-mozg.onrender.com/docs

---

## Why I Built This

Many applicants get rejected before a recruiter even sees their resume because of Applicant Tracking Systems (ATS). I wanted to build a project that gives users an idea of how their resume aligns with a job description while also providing meaningful suggestions for improvement using an LLM.

This project combines traditional skill matching with AI-generated recommendations to create a practical resume analysis tool.

---

## Features

- Upload resumes in PDF or DOCX format
- Extract resume text automatically
- Compare resumes against any job description
- Calculate an ATS compatibility score
- Identify matched and missing skills
- Generate interview questions based on the role
- Suggest projects to strengthen the profile
- Provide resume improvement recommendations
- Recommend learning paths for missing skills

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Python
- Groq API
- Llama 3.3 70B
- PyMuPDF
- python-docx

### Deployment

- Render
- GitHub

---

## Project Structure

```
AI-Resume-Analyzer
│
├── backend
│   ├── main.py
│   ├── requirements.txt
│   ├── runtime.txt
│   └── __init__.py
│
├── frontend
│   ├── app
│   ├── public
│   ├── package.json
│   └── next.config.js
│
├── render.yaml
├── runtime.txt
└── README.md
```

---

## How It Works

1. Upload your resume.
2. The application extracts the text from the document.
3. Paste a job description.
4. The backend identifies important skills from the job description.
5. Skills are matched against the resume.
6. An ATS score is calculated.
7. The AI generates personalized feedback, interview questions, project suggestions, and recommendations for improving the resume.

---

## Running the Project Locally

### Clone the repository

```bash
git clone https://github.com/tarunjilla729/AI-Resume-Analyzer.git

cd AI-Resume-Analyzer
```

---

### Backend

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the backend folder.

```env
GROQ_API_KEY=your_groq_api_key
```

Run the backend

```bash
uvicorn main:app --reload
```

---

### Frontend

```bash
cd frontend

npm install
```

Create a `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Start the frontend

```bash
npm run dev
```

---

## API Endpoints

### Upload Resume

```
POST /upload_resume
```

Extracts text from a PDF or DOCX resume.

---

### Analyze Resume

```
POST /analyze
```

Input

```json
{
  "resume_text": "...",
  "job_description": "..."
}
```

Returns

- ATS Score
- Matching Skills
- Missing Skills
- AI Feedback
- Interview Questions
- Resume Suggestions
- Project Recommendations
- Learning Plan

---

## Future Improvements

Some ideas I would like to add in the future:

- User authentication
- Resume history
- Resume rewriting with AI
- Export report as PDF
- Support multiple LLM providers
- Dark mode
- Better ATS scoring algorithm
- More detailed analytics

---

## Challenges Faced

While building this project, I learned about:

- Integrating Large Language Models into real-world applications
- Building REST APIs using FastAPI
- Handling PDF and DOCX parsing
- Deploying full-stack applications on Render
- Managing environment variables and API keys
- Debugging deployment issues across frontend and backend services

---

## Author

**Tarun Jilla**

GitHub: https://github.com/tarunjilla729

LinkedIn: https://www.linkedin.com/in/tarun-jilla-692b2628a/

---

If you found this project interesting, feel free to star the repository. Feedback and suggestions are always welcome!