import Groq from "groq-sdk";
import type { ResumeData, ResumeGenerationResult } from "@/types/resume";
import { masterResume as defaultResume } from "./resume-data";
import { v4 as uuidv4 } from "uuid";

function resumeToText(resume: ResumeData): string {
  return [
    resume.summary,
    ...(resume.experience || []).flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...Object.values(resume.skills || {}).flat(),
    ...(resume.projects || []).flatMap((p) => [p.name, p.description, ...p.bullets, ...(p.technologies || [])]),
    ...(resume.education || []).flatMap((e) => [e.degree, e.field, e.institution]),
    ...(resume.certifications || []).map((c) => c.name),
  ].filter(Boolean).join(" ").toLowerCase();
}

function calcAtsScore(resume: ResumeData, keywords: string[]): number {
  if (!keywords.length) return 0;
  const text = resumeToText(resume);
  let score = 0;
  for (const kw of keywords) {
    const normalized = kw.toLowerCase().trim();
    if (!normalized) continue;
    if (text.includes(normalized)) {
      score += 1;
    } else if (normalized.includes(" ")) {
      // partial credit: all individual words present
      const words = normalized.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0 && words.every((w) => text.includes(w))) {
        score += 0.6;
      }
    }
  }
  return Math.min(100, Math.round((score / keywords.length) * 100));
}

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) resume optimizer. Your single goal is to maximise keyword coverage so the resume scores 90+ on any ATS checker, while keeping every claim 100% truthful.

CRITICAL RULES — EVERY RULE IS MANDATORY:

ACCURACY
1. NEVER fabricate experience, skills, certifications, or achievements not in the original resume
2. NEVER invent metrics or numbers — only reuse figures already in the original

KEYWORD COVERAGE (most important for ATS score)
3. MANDATORY FULL COVERAGE — every keyword in extractedRequirements.skills, extractedRequirements.technologies, and extractedRequirements.keywords MUST appear verbatim at least once in the optimizedResume. Before writing the JSON, mentally scan each keyword list and confirm coverage.
4. USE EXACT JD PHRASING — never substitute abbreviations for full terms the JD spells out. If JD says "continuous integration", write "continuous integration" not "CI". If JD uses "CI/CD pipelines", use that exact string.
5. If the JD uses both a full form AND an abbreviation (e.g., "CI/CD" and "Continuous Integration"), include BOTH in the resume so either form matches.
6. PRESERVE ATS PHRASES already in the master resume word-for-word (e.g. "scalable web applications", "RESTful API design", "MVC architecture", "security best practices").
7. EMBED the exact job title from the JD in the first sentence of the summary.
8. Reorder each skills array so JD-matching terms appear first; NEVER remove any existing skill; add JD skill terms that the candidate plausibly has based on their work history.

CONTENT VOLUME (more content = more keyword surface area)
9. Summary: 3–4 sentences, 65–90 words, embed the job title AND at least 8 distinct JD keywords.
10. KEEP ALL experience entries — never drop a role. Keep 3–5 bullets per role; choose bullets that can embed the most JD keywords.
11. Target 800–1100 total words across the full resume.

QUALITY
12. Use strong action verbs: developed, built, implemented, designed, integrated, architected, automated, optimized, deployed, collaborated, led, enhanced, streamlined.

RESPOND WITH ONLY VALID JSON — no markdown, no code blocks, no text outside the JSON object.`;

export interface CascadeAttempt {
  model: string;
  ok: boolean;
  httpStatus?: number;
  errorCode?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CascadeMeta {
  modelUsed: string | null;
  failoverOccurred: boolean;
  attempts: CascadeAttempt[];
  totalLatencyMs: number;
  parseError?: string | null;
  rawText?: string;
}

export async function generateOptimizedResume(
  jobDescription: string,
  resumeOverride?: ResumeData,
  options?: { forceModel?: string; forceMaxTokens?: number; forceReasoningEffort?: "none" | "low" | "medium" | "high" }
): Promise<ResumeGenerationResult & { _cascadeMeta?: CascadeMeta }> {
  const masterResume = resumeOverride ?? defaultResume;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  const groq = new Groq({ apiKey });

  const userPrompt = `Analyze this job description and optimize the provided resume for maximum ATS compatibility.

JOB DESCRIPTION:
${jobDescription}

MASTER RESUME DATA:
${JSON.stringify(masterResume)}

Return a JSON object with EXACTLY this structure:
{
  "jobTitle": "extracted job title from JD",
  "company": "extracted company name from JD (or 'Not Specified' if not found)",
  "extractedRequirements": {
    "skills": ["<every hard skill mentioned in JD, use exact phrasing>"],
    "technologies": ["<every technology, tool, platform mentioned in JD>"],
    "responsibilities": ["<key responsibility phrases from JD>"],
    "experience": ["<experience requirements>"],
    "keywords": ["<ALL important ATS keywords from JD including soft skills, methodologies, and domain terms>"]
  },
  "optimizedResume": {
    "personalInfo": <copy exactly from master resume>,
    "summary": "<3-4 sentences, 65-90 words. FIRST sentence MUST contain the exact job title from the JD. Embed AT LEAST 8 distinct JD keywords naturally across the sentences. Example: 'Results-driven [EXACT JOB TITLE] with X years of experience in [JD keyword 1], [JD keyword 2], and [JD keyword 3]...'>",
    "experience": [
      {
        "id": "<same id — ALL roles must be present, never skip>",
        "company": "<same>",
        "title": "<same>",
        "location": "<same>",
        "startDate": "<same>",
        "endDate": "<same>",
        "bullets": ["<3-5 bullets per role. Rewrite each bullet to embed JD keywords using EXACT JD phrasing. Never remove an entire role.>"]
      }
    ],
    "education": "<copy exactly from master resume>",
    "skills": {
      "technical": ["<JD-matching skills FIRST using EXACT JD terms, then remaining skills from master — NEVER remove any>"],
      "frameworks": ["<JD-matching frameworks FIRST — NEVER remove any>"],
      "databases": ["<JD-matching databases FIRST — NEVER remove any>"],
      "cloud": ["<JD-matching cloud services FIRST using exact provider names from JD — NEVER remove any>"],
      "tools": ["<JD-matching tools FIRST — NEVER remove any>"],
      "soft": ["<EVERY soft skill keyword from JD must be here: e.g. communication, problem solving, teamwork, leadership, collaboration, agile, etc.>"]
    },
    "projects": [
      {
        "id": "<same id>",
        "name": "<same>",
        "description": "<rewrite to embed JD keywords naturally>",
        "technologies": ["<same array>"],
        "bullets": ["<2-4 bullets embedding JD keywords>"],
        "link": "<copy EXACTLY from master resume, even if it says 'Link' — never remove or change>",
        "github": "<copy EXACTLY from master resume — never remove or change>"
      }
    ],
    "certifications": "<copy exactly from master resume>"
  },
  "addedKeywords": ["<list EVERY keyword/phrase from the JD that now appears in the optimized resume but was NOT present verbatim in the original master resume — these are highlighted yellow in the preview so list all of them>"],
  "suggestions": [
    "Actionable suggestion 1",
    "Actionable suggestion 2",
    "Actionable suggestion 3",
    "Actionable suggestion 4"
  ]
}`;

  // Primary model can be overridden via GROQ_MODEL env var.
  // Check https://console.groq.com/docs/models for currently available IDs.
  // Primary model can be overridden via GROQ_MODEL env var.
  // Each model family has its own independent rate-limit quota on Groq.
  // llama-3.1-8b-instant removed: hard 6K TPM limit always fails our ~10K token prompt.
  const primaryModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const CASCADE_MODELS = [
    primaryModel,                                    // Llama 3.3 70B — primary
    "qwen/qwen3-32b",                                // Qwen family — separate quota
    "meta-llama/llama-4-scout-17b-16e-instruct",    // Llama 4 family — separate quota
    "openai/gpt-oss-20b",                            // OpenAI OSS family — separate quota
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  // RESEARCH INSTRUMENTATION (local dev / experiment use only):
  // When options.forceModel is set AND the ALLOW_MODEL_OVERRIDE env var is
  // enabled, the cascade is bypassed and exactly one model is called. This
  // exists solely to let the quality-degradation study call each cascade
  // stage directly instead of waiting for a real rate-limit failover.
  // It never activates unless ALLOW_MODEL_OVERRIDE=true is set locally.
  const overrideEnabled = process.env.ALLOW_MODEL_OVERRIDE === "true";
  const MODELS = overrideEnabled && options?.forceModel
    ? [options.forceModel]
    : CASCADE_MODELS;

  let text: string | null = null;
  let lastError: unknown;
  const attempts: CascadeAttempt[] = [];
  const cascadeStart = Date.now();

  for (const model of MODELS) {
    const attemptStart = Date.now();
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: (overrideEnabled && options?.forceMaxTokens) || 8192,
        response_format: { type: "json_object" },
        ...(overrideEnabled && options?.forceReasoningEffort
          ? { reasoning_effort: options.forceReasoningEffort }
          : {}),
      } as Parameters<typeof groq.chat.completions.create>[0]);
      text = completion.choices[0]?.message?.content ?? null;
      attempts.push({
        model,
        ok: !!text,
        latencyMs: Date.now() - attemptStart,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      });
      if (text) break;
    } catch (err: unknown) {
      lastError = err;
      const e = err as { status?: number; error?: { code?: string } };
      attempts.push({
        model,
        ok: false,
        httpStatus: e?.status,
        errorCode: e?.error?.code,
        latencyMs: Date.now() - attemptStart,
      });
      const skip = e?.status === 429 || e?.status === 413 || e?.error?.code === "model_decommissioned";
      if (skip) continue;
      throw err;
    }
  }

  const cascadeMeta: CascadeMeta = {
    modelUsed: attempts.find((a) => a.ok)?.model ?? null,
    failoverOccurred: attempts.length > 1,
    attempts,
    totalLatencyMs: Date.now() - cascadeStart,
  };

  if (!text) {
    if (lastError) throw lastError;
    throw new Error("Empty response from Groq API. Please try again.");
  }

  let parsed: {
    jobTitle?: string;
    company?: string;
    extractedRequirements?: {
      skills?: string[];
      technologies?: string[];
      responsibilities?: string[];
      experience?: string[];
      keywords?: string[];
    };
    originalScore?: number;
    atsScore?: number;
    optimizedResume?: ResumeGenerationResult["optimizedResume"];
    addedKeywords?: string[];
    suggestions?: string[];
  };

  let parseError: string | null = null;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? text.slice(jsonStart, jsonEnd + 1) : text;
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    // Research instrumentation: a malformed/unparseable response from a
    // cascade stage is itself a quality-degradation data point, not just an
    // error to hide. Record it and fall back to the untouched master resume
    // instead of throwing, so the experiment harness gets a labeled failure
    // rather than a dropped request.
    parseError = e instanceof Error ? e.message : "JSON parse failed";
    parsed = {};
  }

  const optimizedResume = parsed.optimizedResume ?? masterResume;
  const allKeywords = Array.from(new Set([
    ...(parsed.extractedRequirements?.skills || []),
    ...(parsed.extractedRequirements?.technologies || []),
    ...(parsed.extractedRequirements?.keywords || []),
  ].map((k) => k.toLowerCase().trim()).filter(Boolean)));
  const originalScore = calcAtsScore(masterResume, allKeywords);
  const atsScore      = calcAtsScore(optimizedResume, allKeywords);

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    jobTitle: parsed.jobTitle || "Position",
    company: parsed.company || "Company",
    originalResume: masterResume,
    optimizedResume,
    atsScore,
    originalScore,
    addedKeywords: parsed.addedKeywords || [],
    extractedRequirements: {
      skills: parsed.extractedRequirements?.skills || [],
      technologies: parsed.extractedRequirements?.technologies || [],
      responsibilities: parsed.extractedRequirements?.responsibilities || [],
      experience: parsed.extractedRequirements?.experience || [],
      keywords: parsed.extractedRequirements?.keywords || [],
    },
    suggestions: parsed.suggestions || [],
    jobDescription,
    _cascadeMeta: { ...cascadeMeta, parseError, rawText: parseError ? text : undefined },
  };
}

export async function generateEmailBody(params: {
  resume: ResumeData;
  jobTitle: string;
  company: string;
  jobDescription?: string;
}): Promise<{ subject: string; body: string }> {
  const { resume, jobTitle, company, jobDescription } = params;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  const groq = new Groq({ apiKey });

  const experienceBlock = (resume.experience || [])
    .map((e) => `- ${e.title} at ${e.company} (${e.startDate}–${e.endDate}):\n${e.bullets.map((b) => `  * ${b}`).join("\n")}`)
    .join("\n");
  const projectsBlock = (resume.projects || [])
    .slice(0, 3)
    .map((p) => `- ${p.name}: ${p.description}`)
    .join("\n");
  const skillsBlock = Object.values(resume.skills || {}).flat().filter(Boolean).join(", ");

  const prompt = `You are writing a job-application email as the CANDIDATE below, to send to a recruiter with their resume attached.

ROLE: ${jobTitle}
COMPANY: ${company || "the company"}
${jobDescription ? `JOB DESCRIPTION (use this to pick which 2-3 achievements/skills to feature — do not quote it back verbatim):\n${jobDescription.slice(0, 2500)}\n` : ""}
CANDIDATE SUMMARY:
${resume.summary}

CANDIDATE WORK EXPERIENCE:
${experienceBlock}

CANDIDATE PROJECTS:
${projectsBlock}

CANDIDATE SKILLS:
${skillsBlock}

CANDIDATE NAME: ${resume.personalInfo.name}
CANDIDATE PHONE: ${resume.personalInfo.phone}
CANDIDATE EMAIL: ${resume.personalInfo.email}

Write a subject line and an email body.

SUBJECT: under 80 characters, format like "Application for ${jobTitle}${company ? ` – ${company}` : ""}" or similar, specific to the role.

BODY — follow this exact structure, separated by blank lines:
1. Greeting: "Dear Hiring Manager," (or "Dear ${company} Recruiting Team," if a company name is given).
2. Opening line: name the exact role and company, and how many years/what kind of experience the candidate brings — one sentence, no filler like "I am excited to apply".
3. Middle paragraph (2-3 sentences): reference 2-3 SPECIFIC achievements or projects from the candidate's actual experience/projects above — include real numbers/metrics if present in the bullets — and connect them directly to what the job description asks for. Do not just list skill names; describe what was built or achieved.
4. Closing line: mention the attached resume and invite next steps (a call/interview).
5. Sign-off: "Best regards," then the candidate's name, phone, and email — each on its own line, with NO blank line between the sign-off, the name, the phone, and the email (single \\n only there, not \\n\\n).

Rules: no generic filler phrases ("I am confident in my ability", "I am a good fit", "team player"), no invented facts beyond what's given above, professional and concise (120-170 words for the body). Use exactly ONE blank line (\\n\\n) between paragraphs 1-4, and never more than one blank line anywhere.

Respond with ONLY valid JSON: {"subject": "...", "body": "..."}`;

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 900,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq API. Please try again.");

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const parsed = JSON.parse(jsonStart !== -1 && jsonEnd !== -1 ? text.slice(jsonStart, jsonEnd + 1) : text);

  return {
    subject: parsed.subject || `Application for ${jobTitle}`,
    body: parsed.body ? normalizeEmailBody(parsed.body) : "",
  };
}

// LLMs don't reliably follow spacing instructions — cap blank lines between
// paragraphs at one, and strip blank lines within the sign-off block (name/
// phone/email), which the model otherwise double-spaces like every other line.
function normalizeEmailBody(raw: string): string {
  const body = raw.trim().replace(/\n{3,}/g, "\n\n");
  const signOff = body.search(/\n\n(Best regards|Regards|Sincerely|Warm regards|Kind regards|Thanks|Thank you)[,.]?\s*\n/i);
  if (signOff === -1) return body;
  const splitAt = signOff + 2;
  return body.slice(0, splitAt) + body.slice(splitAt).replace(/\n{2,}/g, "\n");
}
