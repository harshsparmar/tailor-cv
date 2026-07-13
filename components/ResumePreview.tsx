"use client";

import React from "react";
import type { ResumeData } from "@/types/resume";
import { cn } from "@/lib/utils";

interface Props {
  resume: ResumeData;
  addedKeywords?: string[];
  className?: string;
}

const MONTHS: Record<string, number> = {
  Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12
};
function parseCertDate(date: string): number {
  if (!date) return 0;
  // Match "Feb'22", "Feb'22", "Feb-22", "Feb 22" etc.
  const m = date.match(/^([A-Za-z]{3})[^A-Za-z0-9](\d{2,4})$/);
  if (m) {
    const yr = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    return yr * 100 + (MONTHS[m[1]] ?? 0);
  }
  return date.match(/^\d{4}$/) ? parseInt(date) * 100 : 0;
}

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!keywords || keywords.length === 0) return text;

  const pattern = new RegExp(
    `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );

  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (pattern.test(part)) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 rounded px-0.5"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b-2 border-blue-800 mb-3 pb-1">
      <h2 className="text-[11px] font-bold text-blue-800 tracking-[0.12em] uppercase">{title}</h2>
    </div>
  );
}

export const ResumePreview = React.forwardRef<HTMLDivElement, Props>(function ResumePreview({ resume, addedKeywords = [], className }, ref) {
  const {
    personalInfo,
    summary,
    experience,
    education,
    skills,
    projects,
    certifications,
  } = resume;

  return (
    <div
      id="resume-preview"
      ref={ref}
      className={cn(
        "bg-white text-gray-900 font-sans",
        "shadow-xl rounded-lg overflow-hidden print:shadow-none print:rounded-none",
        className
      )}
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="px-10 py-8" style={{ minHeight: "1056px" }}>
        {/* Header */}
        <div className="border-b-4 border-blue-800 pb-4 mb-5">
          <h1
            className="text-3xl font-bold text-blue-800 tracking-wide"
            style={{ letterSpacing: "0.04em" }}
          >
            {personalInfo.name}
          </h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
            {[
              personalInfo.portfolio && (
                <a
                  href={`https://${personalInfo.portfolio.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline transition-colors"
                >
                  {personalInfo.portfolio}
                </a>
              ),
              personalInfo.github && (
                <a
                  href={`https://${personalInfo.github.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline transition-colors"
                >
                  {personalInfo.github}
                </a>
              ),
              personalInfo.linkedin && (
                <a
                  href={`https://${personalInfo.linkedin.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline transition-colors"
                >
                  {personalInfo.linkedin}
                </a>
              ),
              <a
                href={`mailto:${personalInfo.email}`}
                className="hover:text-blue-700 hover:underline transition-colors"
              >
                {personalInfo.email}
              </a>,
              <a
                href={`tel:${personalInfo.phone.replace(/\s+/g, "")}`}
                className="hover:text-blue-700 hover:underline transition-colors"
              >
                {personalInfo.phone}
              </a>,
              <span>{personalInfo.location}</span>,
            ]
              .filter(Boolean)
              .map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-300">|</span>}
                  {item}
                </React.Fragment>
              ))}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mb-5">
            <SectionHeader title="Professional Summary" />
            <p className="text-[11.5px] text-gray-700 leading-relaxed">
              {highlightKeywords(summary, addedKeywords)}
            </p>
          </div>
        )}

        {/* Experience */}
        {experience?.length > 0 && (
          <div className="mb-5">
            <SectionHeader title="Work Experience" />
            <div className="space-y-4">
              {experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] font-bold text-gray-900">{exp.title}</p>
                      <p className="text-[11.5px] font-semibold text-blue-700">{exp.company}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-[10.5px] text-gray-500 whitespace-nowrap">
                        {exp.startDate} – {exp.endDate}
                      </p>
                      <p className="text-[10.5px] text-gray-500">{exp.location}</p>
                    </div>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {exp.bullets.filter((b) => b.trim()).map((bullet, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-gray-700 leading-relaxed">
                        <span className="text-blue-700 mt-0.5 flex-shrink-0 font-bold">•</span>
                        <span>{highlightKeywords(bullet, addedKeywords)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {skills && (
          <div className="mb-5">
            <SectionHeader title="Technical Skills" />
            <div className="space-y-1">
              {skills.technical && skills.technical.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Languages:</span>
                  <span className="text-gray-700">{skills.technical.join(" • ")}</span>
                </div>
              )}
              {skills.frameworks && skills.frameworks.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Frameworks:</span>
                  <span className="text-gray-700">{skills.frameworks.join(" • ")}</span>
                </div>
              )}
              {skills.databases && skills.databases.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Databases:</span>
                  <span className="text-gray-700">{skills.databases.join(" • ")}</span>
                </div>
              )}
              {skills.cloud && skills.cloud.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Cloud:</span>
                  <span className="text-gray-700">{skills.cloud.join(" • ")}</span>
                </div>
              )}
              {skills.tools && skills.tools.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Tools:</span>
                  <span className="text-gray-700">{skills.tools.join(" • ")}</span>
                </div>
              )}
              {skills.soft && skills.soft.length > 0 && (
                <div className="flex text-[11px]">
                  <span className="font-bold text-gray-800 w-28 flex-shrink-0">Soft Skills:</span>
                  <span className="text-gray-700">{skills.soft.join(" • ")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects?.length > 0 && (
          <div className="mb-5">
            <SectionHeader title="Projects" />
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id}>
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-[12px] font-bold text-gray-900">{proj.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {proj.link && /[./]/.test(proj.link) && (
                        <a
                          href={`https://${proj.link.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-700 hover:underline"
                        >
                          Link
                        </a>
                      )}
                      {proj.github && (
                        <a
                          href={`https://${proj.github.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-700 hover:underline"
                        >
                          {proj.github}
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600 italic mb-1">{proj.description}</p>
                  {proj.technologies?.length > 0 && (
                    <p className="text-[10.5px] text-gray-500 mb-1">
                      <span className="font-semibold">Tech:</span> {proj.technologies.join(" • ")}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {proj.bullets.filter((b) => b.trim()).map((bullet, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-gray-700 leading-relaxed">
                        <span className="text-blue-700 mt-0.5 flex-shrink-0 font-bold">•</span>
                        <span>{highlightKeywords(bullet, addedKeywords)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {education?.length > 0 && (
          <div className="mb-5">
            <SectionHeader title="Education" />
            {education.map((edu) => (
              <div key={edu.id} className="flex justify-between items-start">
                <div>
                  <p className="text-[12px] font-bold text-gray-900">
                    {edu.degree && edu.field
                      ? `${edu.degree} in ${edu.field}`
                      : edu.degree || edu.field || ""}
                  </p>
                  <p className="text-[11.5px] font-semibold text-blue-700">{edu.institution}</p>
                  {edu.cgpa && (
                    <p className="text-[10.5px] text-gray-600">CGPA: {edu.cgpa}</p>
                  )}
                  {edu.honors?.map((h, i) => (
                    <p key={i} className="text-[10.5px] text-gray-600">{h}</p>
                  ))}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-[10.5px] text-gray-500">
                    {edu.startDate && edu.endDate
                      ? `${edu.startDate} – ${edu.endDate}`
                      : edu.startDate || edu.endDate || ""}
                  </p>
                  {edu.location && !edu.institution?.toLowerCase().includes(edu.location.toLowerCase()) && (
                    <p className="text-[10.5px] text-gray-500">{edu.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Academic & Extracurricular Achievements */}
        {certifications && certifications.length > 0 && (
          <div className="mb-5">
            <SectionHeader title="Academic and Extracurricular Achievements" />
            <div className="space-y-1.5">
              {[...certifications].sort((a, b) => parseCertDate(b.date) - parseCertDate(a.date)).map((cert) => (
                <div key={cert.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-[11.5px] font-bold text-gray-900">{cert.name}</p>
                    {cert.issuer && (
                      <p className="text-[11px] text-gray-600">{cert.issuer}</p>
                    )}
                    {cert.description && (
                      <p className="text-[11px] text-gray-600 italic">{cert.description}</p>
                    )}
                  </div>
                  {cert.date && (
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-[10.5px] text-gray-500">{cert.date}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
