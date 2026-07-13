"use client";

import { useState } from "react";
import { FileText, FileDown, Mail, Loader2, Check } from "lucide-react";
import { cn, downloadBlob, sanitizeFilename } from "@/lib/utils";
import type { ResumeData } from "@/types/resume";
import { EmailResumeModal } from "@/components/EmailResumeModal";

interface Props {
  resume: ResumeData;
  jobTitle: string;
  company: string;
  jobDescription?: string;
}

type DownloadState = "idle" | "loading" | "done" | "error";

export function DownloadButtons({ resume, jobTitle, company, jobDescription }: Props) {
  const [pdfState,  setPdfState]  = useState<DownloadState>("idle");
  const [docxState, setDocxState] = useState<DownloadState>("idle");
  const [emailOpen, setEmailOpen] = useState(false);

  async function handleDownload(format: "pdf" | "docx") {
    const setState = format === "pdf" ? setPdfState : setDocxState;
    setState("loading");
    try {
      const res = await fetch(`/api/download/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobTitle, company }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      const blob = await res.blob();
      const name  = sanitizeFilename(resume.personalInfo.name);
      const title = sanitizeFilename(jobTitle || "resume");
      downloadBlob(blob, `${name}_${title}.${format}`);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div className="flex gap-2">
      <Btn
        label="PDF"
        icon={<FileText className="w-3.5 h-3.5" />}
        state={pdfState}
        onClick={() => handleDownload("pdf")}
      />
      <Btn
        label="DOCX"
        icon={<FileDown className="w-3.5 h-3.5" />}
        state={docxState}
        onClick={() => handleDownload("docx")}
      />
      <Btn
        label="Resume"
        idleLabel="Email Resume"
        icon={<Mail className="w-3.5 h-3.5" />}
        state="idle"
        onClick={() => setEmailOpen(true)}
      />
      {emailOpen && (
        <EmailResumeModal
          resume={resume}
          jobTitle={jobTitle}
          company={company}
          jobDescription={jobDescription}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </div>
  );
}

function Btn({
  label, idleLabel, icon, state, onClick,
}: {
  label: string;
  idleLabel?: string;
  icon: React.ReactNode;
  state: DownloadState;
  onClick: () => void;
}) {
  const loading = state === "loading";
  const done    = state === "done";
  const error   = state === "error";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        done
          ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
          : error
          ? "bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
          : "bg-white dark:bg-stone-900/50 border border-stone-200 dark:border-white/[0.08] text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/[0.04] hover:border-stone-300 dark:hover:border-white/20"
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : done ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        icon
      )}
      {error ? "Retry" : done ? "Saved" : idleLabel ?? `Export ${label}`}
    </button>
  );
}
