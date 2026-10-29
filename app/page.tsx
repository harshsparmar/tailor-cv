"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Header } from "@/components/Header";
import { JobDescriptionInput } from "@/components/JobDescriptionInput";
import { ResumePreview } from "@/components/ResumePreview";
import { ATSScoreCard } from "@/components/ATSScoreCard";
import { DownloadButtons } from "@/components/DownloadButtons";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ResumeUpload } from "@/components/ResumeUpload";
import type { ResumeData, ResumeGenerationResult } from "@/types/resume";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "resume_optimizer_history";
const RESUME_KEY  = "resume_optimizer_master_resume";
const MAX_HISTORY = 10;

type PreviewMode = "optimized" | "original";

export default function HomePage() {
  const { user } = useAuth();
  const supabase  = useMemo(() => createClient(), []);
  const userRef   = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [result,           setResult]           = useState<ResumeGenerationResult | null>(null);
  const [previewMode,      setPreviewMode]      = useState<PreviewMode>("optimized");
  const [history,          setHistory]          = useState<ResumeGenerationResult[]>([]);
  const [uploadedResume,   setUploadedResume]   = useState<ResumeData | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDefaultResume,  setIsDefaultResume]  = useState(false);
  const [isSavingDefault,  setIsSavingDefault]  = useState(false);

  const uploadedResumeRef = useRef<ResumeData | null>(null);
  useEffect(() => { uploadedResumeRef.current = uploadedResume; }, [uploadedResume]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
    try {
      const stored = localStorage.getItem(RESUME_KEY);
      if (stored) {
        const { resume, fileName, isDefault } = JSON.parse(stored);
        setUploadedResume(resume);
        setUploadedFileName(fileName);
        if (isDefault) setIsDefaultResume(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Sync cloud history on login
  useEffect(() => {
    if (!user) return;
    supabase.from("resumes").select("data")
      .order("created_at", { ascending: false }).limit(MAX_HISTORY)
      .then(({ data }) => {
        if (!data) return;
        const cloud = data.map((r) => r.data as ResumeGenerationResult);
        setHistory((prev) => {
          const merged = [
            ...cloud,
            ...prev.filter((p) => !cloud.find((c) => c.id === p.id)),
          ].slice(0, MAX_HISTORY);
          try { localStorage.setItem(HISTORY_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
          return merged;
        });
      });
  }, [user]);

  // Auto-load default resume on login — listen to auth events directly so the
  // session token is guaranteed to be active when the profile query runs.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        if (uploadedResumeRef.current) return;
        supabase.from("profiles")
          .select("default_resume, default_resume_filename")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.default_resume && !uploadedResumeRef.current) {
              const resume   = data.default_resume as ResumeData;
              const fileName = (data.default_resume_filename as string) ?? "Default Resume";
              setUploadedResume(resume);
              setUploadedFileName(fileName);
              setIsDefaultResume(true);
              try { localStorage.setItem(RESUME_KEY, JSON.stringify({ resume, fileName, isDefault: true })); } catch { /* ignore */ }
            }
          });
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSetDefault() {
    if (!user || !uploadedResume) return;
    setIsSavingDefault(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      default_resume: uploadedResume,
      default_resume_filename: uploadedFileName ?? "Resume",
      updated_at: new Date().toISOString(),
    });
    setIsSavingDefault(false);
    if (!error) {
      setIsDefaultResume(true);
      try { localStorage.setItem(RESUME_KEY, JSON.stringify({ resume: uploadedResume, fileName: uploadedFileName, isDefault: true })); } catch { /* ignore */ }
    }
  }

  async function handleClearDefault() {
    if (!user) return;
    await supabase.from("profiles")
      .update({ default_resume: null, default_resume_filename: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setIsDefaultResume(false);
    setUploadedResume(null);
    setUploadedFileName(null);
    try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
  }

  function handleResumeUpload(resume: ResumeData, fileName: string) {
    setUploadedResume(resume);
    setUploadedFileName(fileName);
    setIsDefaultResume(false);
    try { localStorage.setItem(RESUME_KEY, JSON.stringify({ resume, fileName })); } catch { /* ignore */ }
  }

  function handleResumeReset() {
    setUploadedResume(null);
    setUploadedFileName(null);
    setIsDefaultResume(false);
    try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
  }

  function saveToHistory(item: ResumeGenerationResult) {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const updated  = [item, ...filtered].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    const currentUser = userRef.current;
    if (currentUser) {
      supabase.from("resumes").upsert({ id: item.id, user_id: currentUser.id, data: item })
        .then(({ error }) => { if (error) console.error("Cloud save failed:", error.message); });
    }
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    const currentUser = userRef.current;
    if (currentUser) {
      supabase.from("resumes").delete().eq("user_id", currentUser.id)
        .then(({ error }) => { if (error) console.error("Cloud clear failed:", error.message); });
    }
  }

  const handleGenerate = useCallback(async (jobDescription: string) => {
    setIsLoading(true);
    setError(null);
    setPreviewMode("optimized");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          ...(uploadedResumeRef.current ? { uploadedResume: uploadedResumeRef.current } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate resume");
      setResult(data as ResumeGenerationResult);
      saveToHistory(data as ResumeGenerationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const currentResume = result
    ? previewMode === "optimized" ? result.optimizedResume : result.originalResume
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F1EC] dark:bg-[#0a0908]">
      <Header />

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">


        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-2xl p-8 shadow-warm-lg flex flex-col items-center gap-4 max-w-xs mx-4 animate-slide-up text-center">
              <div className="w-10 h-10 rounded-full border-2 border-stone-200 dark:border-stone-600 border-t-violet-500 dark:border-t-violet-400 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-white">
                  Tailoring your resume
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Analyzing job description and rewriting for ATS…
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 animate-fade-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* ── Left column ── */}
          <div className="lg:col-span-1 flex flex-col gap-3 min-h-0">

            {/* Resume upload */}
            <div className="bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-200 dark:border-white/[0.07] p-4">
              <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] uppercase text-stone-400 dark:text-stone-500 mb-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
                Resume
              </p>
              <ResumeUpload
                uploadedResume={uploadedResume}
                uploadedFileName={uploadedFileName}
                onUpload={handleResumeUpload}
                onReset={handleResumeReset}
                isLoggedIn={!!user}
                isDefault={isDefaultResume}
                isSavingDefault={isSavingDefault}
                onSetDefault={handleSetDefault}
                onClearDefault={handleClearDefault}
              />
            </div>

            {/* Job description */}
            <div className="bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-200 dark:border-white/[0.07] p-4 flex-1 flex flex-col min-h-0">
              <JobDescriptionInput
                onGenerate={handleGenerate}
                isLoading={isLoading}
                hasResume={!!uploadedResume}
              />
            </div>

            {/* ATS Score */}
            {result && (
              <div className="bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-200 dark:border-white/[0.07] p-4 animate-slide-up">
                <div className="mb-4">
                  <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] uppercase text-stone-400 dark:text-stone-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
                    ATS Analysis
                  </p>
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mt-1.5 truncate">
                    {result.jobTitle}
                    <span className="text-stone-400 dark:text-stone-500 font-normal"> · {result.company}</span>
                  </p>
                </div>
                <ATSScoreCard result={result} />
              </div>
            )}

            {/* History */}
            <HistoryPanel
              history={history}
              onSelect={(item) => { setResult(item); setPreviewMode("optimized"); }}
              onClear={clearHistory}
              selectedId={result?.id}
            />
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            {result && currentResume ? (
              <>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center bg-stone-100 dark:bg-white/[0.06] rounded-full p-0.5">
                    {(["optimized", "original"] as PreviewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPreviewMode(mode)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
                          previewMode === mode
                            ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-warm"
                            : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <DownloadButtons
                    resume={result.optimizedResume}
                    jobTitle={result.jobTitle}
                    company={result.company}
                    jobDescription={result.jobDescription}
                  />
                </div>

                {/* Keyword banner */}
                {previewMode === "optimized" && result.addedKeywords.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 rounded-lg text-[11px] animate-fade-in">
                    <mark className="bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-300 rounded px-0.5 font-medium">yellow</mark>
                    <span className="text-amber-600 dark:text-amber-500">= newly added keywords</span>
                  </div>
                )}

                {/* Resume preview */}
                <div className="bg-stone-200/50 dark:bg-black/40 rounded-2xl p-5 overflow-auto animate-fade-in border border-stone-200 dark:border-white/[0.06]" style={{ maxHeight: "calc(100vh - 160px)" }}>
                  <div className="max-w-[794px] mx-auto">
                    <ResumePreview
                      resume={currentResume}
                      addedKeywords={previewMode === "optimized" ? result.addedKeywords : []}
                    />
                  </div>
                </div>
              </>
            ) : (
              !isLoading && (
                <div className="flex-1 flex flex-col justify-between rounded-2xl border border-dashed border-stone-300 dark:border-white/[0.07] p-8 animate-fade-in">
                  {/* Headline */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                      <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-stone-500 dark:text-stone-400">
                        AI-Powered · ATS Optimization
                      </span>
                    </div>
                    <h2 className="font-serif text-4xl sm:text-5xl leading-[1.08] tracking-tight text-stone-900 dark:text-white max-w-md">
                      Tailor your resume<br />
                      to{" "}
                      <em className="italic text-violet-600 dark:text-violet-400">every job.</em>
                    </h2>
                    <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs leading-relaxed mt-4">
                      Upload your resume and paste a job description — your ATS-optimized version appears here.
                    </p>
                  </div>
                  {/* Bottom hint */}
                  <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-600">
                    <Eye className="w-4 h-4" />
                    Preview will appear here after optimization
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </main>


      <footer className="border-t border-stone-200 dark:border-white/[0.05] py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-600">
          <p>
            © 2026 TailorCV · Built by{" "}
            <a href="https://www.harsh-p.dev" className="hover:underline">
              Harsh Parmar
            </a>
          </p>
          <p>Resume data stays private</p>
        </div>
      </footer>
    </div>
  );
}
