"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type AiFeedback = {
  strengthsSentence?: string;
  skillsPresent?: string[];
  skillsMissing?: string[];
  skillsPresentSentence?: string;
  skillsMissingSentence?: string;
  interviewQuestions?: string[];
  recommendedProjects?: string[];
  resumeRewriteSuggestions?: string[];
  masterySuggestions?: {
    overallPlan?: string[];
    missingSkillMastery?: Record<string, string[]>;
  };
  finalRecommendation?: string;
};

async function getResponseError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text);
    return parsed.detail || parsed.error || text;
  } catch {
    return text;
  }
}

function PanelIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/95 shadow-sm">
      <Image src={src} alt={alt} width={20} height={20} />
    </span>
  );
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeApiBaseUrl, setActiveApiBaseUrl] = useState("Detecting backend");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;

    async function findBackend() {
      setBackendStatus("checking");
      try {
        const response = await fetch("/api/backend_status", { cache: "no-store" });
        const data = await response.json();

        if (!cancelled && response.ok) {
          setActiveApiBaseUrl(data.backend || "Backend detected");
          setBackendStatus("online");
          return;
        }
      } catch {
        // The UI below will show the backend as offline.
      }

      if (!cancelled) {
        setActiveApiBaseUrl("Start FastAPI on port 8000 or 8001");
        setBackendStatus("offline");
      }
    }

    findBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload_resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const backendUrl = response.headers.get("x-backend-url");
      const data = await response.json();
      if (!data.resume_text) {
        throw new Error("The backend could not find readable text in this resume.");
      }

      if (backendUrl) setActiveApiBaseUrl(backendUrl);
      setBackendStatus("online");
      setResumeText(data.resume_text);
      setScore(null);
      setAiFeedback(null);
      setMatchedSkills([]);
      setMissingSkills([]);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Upload failed";
      setErrorMsg(`Resume upload failed: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const analyzeResume = async () => {
    setErrorMsg(null);

    const r = resumeText.trim();
    const jd = jobDescription.trim();

    if (!r) {
      setErrorMsg("Upload a resume or paste resume text first.");
      return;
    }

    if (!jd) {
      setErrorMsg("Paste a job description first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: r, job_description: jd }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const backendUrl = response.headers.get("x-backend-url");
      const data = await response.json();
      if (backendUrl) setActiveApiBaseUrl(backendUrl);
      setBackendStatus("online");
      setScore(data.score ?? null);
      setMatchedSkills(data.matched_skills || []);
      setMissingSkills(data.missing_skills || []);
      setAiFeedback(data.ai_feedback || null);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Analysis failed";
      setErrorMsg(`Error analyzing resume: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const presentSentence = aiFeedback?.skillsPresentSentence;
  const missingSentence = aiFeedback?.skillsMissingSentence;
  const extractedKB = Math.round(((resumeText?.length || 0) / 1024) * 10) / 10;
  const mastery = aiFeedback?.masterySuggestions?.missingSkillMastery || {};
  const statusText =
    backendStatus === "checking" ? "Checking backend" : backendStatus === "online" ? "Backend online" : "Backend offline";

  return (
    <main className="min-h-screen bg-[#eef2ff] text-zinc-950">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#0f766e_0%,#4f46e5_45%,#f97316_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(253,230,138,0.35),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.10),rgba(238,242,255,0.92)_58%)]" />

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
        <header className="grid gap-5 rounded-lg border border-white/25 bg-slate-950/80 p-5 text-white shadow-2xl shadow-slate-950/20 backdrop-blur lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2 shadow-sm backdrop-blur">
              <PanelIcon src="/file.svg" alt="Resume file" />
              <div>
                <p className="text-sm font-semibold">AI Resume Analyzer</p>
                <p className="text-xs text-cyan-100">{statusText}: {activeApiBaseUrl}</p>
              </div>
            </div>

            <h1 className="max-w-3xl text-3xl font-bold tracking-normal text-white sm:text-4xl">
              Resume match studio
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50 sm:text-base">
              Upload a resume, inspect the extracted text immediately, compare it with a job
              description, and generate a focused improvement plan.
            </p>
          </div>

          <div className="grid grid-cols-3 rounded-lg border border-white/20 bg-white/10 p-1 shadow-sm backdrop-blur">
            <div className="rounded-md px-3 py-3 text-center">
              <p className="text-xs text-cyan-100">Resume</p>
              <p className="mt-1 text-sm font-semibold">{resumeText ? "Loaded" : "Empty"}</p>
            </div>
            <div className="rounded-md border-x border-white/20 px-3 py-3 text-center">
              <p className="text-xs text-cyan-100">Extracted</p>
              <p className="mt-1 text-sm font-semibold">{extractedKB} KB</p>
            </div>
            <div className="rounded-md px-3 py-3 text-center">
              <p className="text-xs text-cyan-100">Score</p>
              <p className="mt-1 text-sm font-semibold">{score === null ? "--" : `${score}%`}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-5 shadow-xl shadow-cyan-950/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <PanelIcon src="/file.svg" alt="Resume" />
                <div>
                  <h2 className="text-lg font-semibold text-cyan-950">Resume text</h2>
                  <p className="mt-1 text-sm text-cyan-800">Upload PDF or DOCX, then edit if needed.</p>
                </div>
              </div>
              <span className="rounded-md bg-cyan-700 px-2 py-1 text-xs font-medium text-white">
                Visible
              </span>
            </div>

            <label className="mt-5 block rounded-lg border border-dashed border-cyan-500 bg-white p-4 transition hover:border-indigo-500 hover:bg-indigo-50">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="block w-full text-sm text-cyan-900 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
              />
            </label>

            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder={uploading ? "Extracting resume text..." : "Extracted resume text will appear here immediately."}
              className="mt-4 min-h-80 w-full resize-y rounded-lg border border-cyan-300 bg-white p-4 text-sm leading-6 text-zinc-800 outline-none transition placeholder:text-cyan-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-5 shadow-xl shadow-indigo-950/10">
            <div className="flex items-start gap-3">
              <PanelIcon src="/globe.svg" alt="Job description" />
              <div>
                <h2 className="text-lg font-semibold text-indigo-950">Job description</h2>
                <p className="mt-1 text-sm text-indigo-800">Paste the role requirements you are targeting.</p>
              </div>
            </div>

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job description..."
              className="mt-5 min-h-[424px] w-full resize-y rounded-lg border border-indigo-300 bg-white p-4 text-sm leading-6 text-zinc-800 outline-none transition placeholder:text-indigo-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </section>

        <div className="mt-5 grid gap-4 rounded-lg border border-white/20 bg-gradient-to-r from-cyan-700 via-indigo-700 to-orange-600 p-4 text-white shadow-xl shadow-indigo-950/20 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <span className="h-3 w-3 rounded-sm bg-teal-400" />
            <span className="h-3 w-3 rounded-full bg-orange-300" />
            <span className="h-3 w-3 rotate-45 bg-rose-300" />
            <span>{uploading ? "Reading resume..." : loading ? "Preparing AI feedback..." : "Ready for analysis"}</span>
          </div>

          <button
            onClick={analyzeResume}
            disabled={loading || uploading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-indigo-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            {errorMsg}
          </div>
        )}

        {score !== null && aiFeedback && (
          <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-6 shadow-xl shadow-orange-950/10">
              <p className="text-sm font-medium text-zinc-500">ATS Score</p>
              <div className="mt-3 flex items-end gap-3">
                <p
                  className={`text-5xl font-bold tracking-normal ${
                    score >= 75 ? "text-teal-700" : score >= 50 ? "text-orange-600" : "text-rose-600"
                  }`}
                >
                  {score}%
                </p>
                <p className="pb-1 text-sm text-zinc-500">match</p>
              </div>
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-teal-600"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-6 text-sm leading-6 text-zinc-600">
                Mirror job wording for skills and tools without keyword stuffing.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-white p-6 shadow-xl shadow-indigo-950/10 lg:col-span-2">
              <h2 className="text-xl font-semibold">Skill match summary</h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <p className="text-sm font-semibold text-teal-800">Present skills</p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">
                    {presentSentence || "Your resume demonstrates relevant skills based on the job description."}
                  </p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-800">Missing skills</p>
                  <p className="mt-2 text-sm leading-6 text-rose-950">
                    {missingSentence || "Focus on the missing capabilities implied by the job description."}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Resume strengths</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {aiFeedback.strengthsSentence || "No strengths summary returned."}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Overall improvement plan</h3>
                  {aiFeedback.masterySuggestions?.overallPlan?.length ? (
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">
                      {aiFeedback.masterySuggestions.overallPlan.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No improvement plan generated.</p>
                  )}
                </div>
              </div>

              <div className="mt-7">
                <h3 className="font-semibold">Mastery plan for missing skills</h3>
                {Object.keys(mastery).length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {Object.entries(mastery).map(([skill, steps]) => (
                      <div key={skill} className="rounded-lg border border-zinc-200 bg-[#fafaf8] p-4">
                        <p className="font-semibold">{skill}</p>
                        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm leading-6 text-zinc-600">
                          {(steps || []).map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    The model did not return per-skill mastery steps. Use the overall plan above.
                  </p>
                )}
              </div>

              <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Interview questions</h3>
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-[#fafaf8] p-4">
                    {aiFeedback.interviewQuestions?.length ? (
                      <ol className="list-inside list-decimal space-y-2 text-sm leading-6 text-zinc-600">
                        {aiFeedback.interviewQuestions.map((question, index) => (
                          <li key={index}>{question}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-zinc-500">No interview questions generated.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Recommended projects</h3>
                  <div className="mt-3 space-y-3">
                    {aiFeedback.recommendedProjects?.length ? (
                      aiFeedback.recommendedProjects.map((project, index) => (
                        <div key={index} className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                          <p className="text-sm font-medium leading-6 text-orange-950">{project}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No recommended projects generated.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <h3 className="font-semibold">Resume rewrite suggestions</h3>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-[#fafaf8] p-4">
                  {aiFeedback.resumeRewriteSuggestions?.length ? (
                    <ul className="space-y-3 text-sm leading-6 text-zinc-600">
                      {aiFeedback.resumeRewriteSuggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No rewrite suggestions available.</p>
                  )}
                </div>
              </div>

              <div className="mt-7 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Final recommendation</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {aiFeedback.finalRecommendation || "No final recommendation generated."}
                </p>
              </div>

              <div className="hidden">
                <pre>{JSON.stringify({ matchedSkills, missingSkills }, null, 2)}</pre>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
