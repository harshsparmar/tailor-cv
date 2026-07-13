import { NextRequest, NextResponse } from "next/server";
import { generateOptimizedResume } from "@/lib/groq";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobDescription, uploadedResume, forceModel, forceMaxTokens, forceReasoningEffort } = body;

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json(
        { error: "jobDescription is required and must be a string" },
        { status: 400 }
      );
    }

    if (!uploadedResume) {
      return NextResponse.json(
        { error: "Please upload your resume before generating." },
        { status: 400 }
      );
    }

    if (jobDescription.trim().length < 50) {
      return NextResponse.json(
        { error: "Job description is too short. Please paste the full job description." },
        { status: 400 }
      );
    }

    if (jobDescription.length > 15000) {
      return NextResponse.json(
        { error: "Job description is too long. Please limit to 15,000 characters." },
        { status: 400 }
      );
    }

    const result = await generateOptimizedResume(
      jobDescription,
      uploadedResume,
      (forceModel || forceMaxTokens || forceReasoningEffort)
        ? { forceModel, forceMaxTokens, forceReasoningEffort }
        : undefined
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[/api/generate] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("GROQ_API_KEY")) {
        return NextResponse.json(
          { error: "API key not configured. Please set GROQ_API_KEY in your environment." },
          { status: 500 }
        );
      }
      if (error.message.includes("parse")) {
        return NextResponse.json(
          { error: "Failed to process AI response. Please try again." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
