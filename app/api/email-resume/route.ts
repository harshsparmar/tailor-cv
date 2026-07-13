import { NextRequest, NextResponse } from "next/server";
import { generateResumePdf } from "@/lib/pdf";
import { getMailer } from "@/lib/mailer";
import type { ResumeData } from "@/types/resume";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;white-space:pre-wrap;">${escaped}</div>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, jobTitle, recruiterEmail, subject, message } = body as {
      resume: ResumeData;
      jobTitle: string;
      company: string;
      recruiterEmail: string;
      subject: string;
      message: string;
    };

    if (!resume || !resume.personalInfo) {
      return NextResponse.json({ error: "Invalid resume data" }, { status: 400 });
    }
    if (!recruiterEmail || !EMAIL_RE.test(recruiterEmail)) {
      return NextResponse.json({ error: "Invalid recruiter email" }, { status: 400 });
    }

    const pdf = await generateResumePdf(resume);
    const name = resume.personalInfo.name.replace(/\s+/g, "_");
    const filename = `${name}_Resume_${(jobTitle || "Optimized").replace(/\s+/g, "_")}.pdf`;

    await getMailer().sendMail({
      from: `"${resume.personalInfo.name}" <${process.env.GMAIL_USER}>`,
      to: recruiterEmail,
      replyTo: resume.personalInfo.email,
      subject: subject || `Application for ${jobTitle}`,
      text: message,
      html: toHtml(message),
      attachments: [{ filename, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/email-resume] Error:", error);
    return NextResponse.json(
      { error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
