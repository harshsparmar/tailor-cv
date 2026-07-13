import { NextRequest, NextResponse } from "next/server";
import { generateResumePdf } from "@/lib/pdf";
import type { ResumeData } from "@/types/resume";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, jobTitle } = body as {
      resume: ResumeData;
      jobTitle: string;
      company: string;
    };

    if (!resume || !resume.personalInfo) {
      return NextResponse.json({ error: "Invalid resume data" }, { status: 400 });
    }

    const pdf = await generateResumePdf(resume);

    const name     = resume.personalInfo.name.replace(/\s+/g, "_");
    const filename = `${name}_Resume_${(jobTitle || "Optimized").replace(/\s+/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[/api/download/pdf] Error:", error);
    return NextResponse.json(
      { error: `Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
