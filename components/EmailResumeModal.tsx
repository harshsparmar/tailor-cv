"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CheckCircle, Sparkles, Star, StarOff } from "lucide-react";
import type { ResumeData } from "@/types/resume";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const EMAIL_TEMPLATE_KEY = "resume_optimizer_email_template";

interface Props {
  open: boolean;
  resume: ResumeData;
  jobTitle: string;
  company: string;
  jobDescription?: string;
  onClose: () => void;
}

export function EmailResumeModal({ open, resume, jobTitle, company, jobDescription, onClose }: Props) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [subject, setSubject] = useState(
    `Application for ${jobTitle}${company ? ` at ${company}` : ""}`
  );
  const [message, setMessage] = useState(
    `Hi,\n\nI'm reaching out regarding the ${jobTitle} role${company ? ` at ${company}` : ""}. I've attached my resume for your review.\n\nLooking forward to the opportunity to discuss further.\n\nBest regards,\n${[resume.personalInfo.name, resume.personalInfo.portfolio, `${resume.personalInfo.phone} | ${resume.personalInfo.email}`].filter(Boolean).join("\n")}`
  );
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  // Load the user's saved default template, if any, overriding the built-in one above.
  useEffect(() => {
    let cancelled = false;
    async function loadDefault() {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("default_email_subject, default_email_body")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        if (data?.default_email_body) {
          setSubject(data.default_email_subject || subject);
          setMessage(data.default_email_body);
          setIsDefaultTemplate(true);
          return;
        }
      }
      try {
        const stored = localStorage.getItem(EMAIL_TEMPLATE_KEY);
        if (stored && !cancelled) {
          const saved = JSON.parse(stored) as { subject?: string; body?: string };
          if (saved.body) {
            setSubject(saved.subject || subject);
            setMessage(saved.body);
            setIsDefaultTemplate(true);
          }
        }
      } catch { /* ignore */ }
    }
    loadDefault();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSetDefaultTemplate() {
    setSavingDefault(true);
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        default_email_subject: subject,
        default_email_body: message,
        updated_at: new Date().toISOString(),
      });
    }
    try { localStorage.setItem(EMAIL_TEMPLATE_KEY, JSON.stringify({ subject, body: message })); } catch { /* ignore */ }
    setIsDefaultTemplate(true);
    setSavingDefault(false);
  }

  async function handleClearDefaultTemplate() {
    setSavingDefault(true);
    if (user) {
      await supabase.from("profiles")
        .update({ default_email_subject: null, default_email_body: null, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    try { localStorage.removeItem(EMAIL_TEMPLATE_KEY); } catch { /* ignore */ }
    setIsDefaultTemplate(false);
    setSavingDefault(false);
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/email-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobTitle, company, jobDescription }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to generate");
      const { subject: aiSubject, body } = await res.json();
      if (aiSubject) setSubject(aiSubject);
      if (body) setMessage(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/email-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobTitle, company, recruiterEmail, subject, message }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to send");
      setSent(recruiterEmail);
      setRecruiterEmail("");
      setTimeout(() => setSent(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/[0.08] rounded-2xl shadow-warm-lg w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">
            Email this resume
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <form onSubmit={handleSend} className="flex flex-col gap-3">
            {sent && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Sent to {sent} — add another recruiter to send again.
              </div>
            )}
            <input
              type="email"
              required
              placeholder="Recruiter's email"
              value={recruiterEmail}
              onChange={(e) => setRecruiterEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
            />
            <input
              type="text"
              required
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Message
                {isDefaultTemplate && <span className="text-violet-500 dark:text-violet-400"> · default loaded</span>}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={isDefaultTemplate ? handleClearDefaultTemplate : handleSetDefaultTemplate}
                  disabled={savingDefault}
                  title={isDefaultTemplate ? "Remove default template" : "Save as default template"}
                  className={cn(
                    "p-1.5 rounded-full border transition-colors disabled:opacity-50",
                    isDefaultTemplate
                      ? "border-violet-200 dark:border-violet-800/60 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                      : "border-stone-200 dark:border-white/[0.08] text-stone-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-stone-50 dark:hover:bg-white/[0.04]"
                  )}
                >
                  {savingDefault ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isDefaultTemplate ? (
                    <StarOff className="w-3.5 h-3.5" />
                  ) : (
                    <Star className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  title="Generate with AI from your resume"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {generating ? "Writing…" : "Generate with AI"}
                </button>
              </div>
            </div>
            <textarea
              required
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-colors resize-none"
            />
            {!user && (
              <p className="text-[11px] text-stone-400 dark:text-stone-600 -mt-1">
                Sign in to sync your default template across devices — it's saved on this browser for now.
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-stone-900 dark:bg-white hover:bg-stone-700 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-sm font-semibold transition-colors disabled:opacity-60 mt-1"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
