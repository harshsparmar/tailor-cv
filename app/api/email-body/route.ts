import { NextRequest, NextResponse } from "next/server";
import { generateEmailBody } from "@/lib/groq";
import type { ResumeData } from "@/types/resume";

export async function POST(req: NextRequest) {
  try {
    const { resume, jobTitle, company, jobDescription } = (await req.json()) as {
      resume: ResumeData;
      jobTitle: string;
      company: string;
      jobDescription?: string;
    };

    if (!resume || !resume.personalInfo) {
      return NextResponse.json({ error: "Invalid resume data" }, { status: 400 });
    }

    const result = await generateEmailBody({ resume, jobTitle, company, jobDescription });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/email-body] Error:", error);
    return NextResponse.json(
      { error: `Failed to generate email: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
