import type { ResumeData } from "@/types/resume";

const MONTHS: Record<string, number> = {
  Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12
};
function parseCertDate(date: string): number {
  if (!date) return 0;
  const m = date.match(/^([A-Za-z]{3})[^A-Za-z0-9](\d{2,4})$/);
  if (m) {
    const yr = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    return yr * 100 + (MONTHS[m[1]] ?? 0);
  }
  return date.match(/^\d{4}$/) ? parseInt(date) * 100 : 0;
}

function e(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionTitle(title: string): string {
  return `<div class="border-b-2 border-blue-800 mb-3 pb-1">
      <h2 class="text-[11px] font-bold text-blue-800 tracking-[0.12em] uppercase">${e(title)}</h2>
    </div>`;
}

function bulletItem(text: string): string {
  if (!text.trim()) return "";
  return `<li class="flex gap-2 text-[11px] text-gray-700 leading-relaxed break-inside-avoid">
            <span class="text-blue-700 mt-0.5 flex-shrink-0 font-bold">•</span>
            <span>${e(text)}</span>
          </li>`;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function buildResumeHtml(resume: ResumeData): string {
  const { personalInfo, summary, experience, education, skills, projects, certifications } = resume;

  // ── Header ──────────────────────────────────────────────────────────────
  const contactParts: string[] = [];
  const addContactSep = () => { if (contactParts.length > 0) contactParts.push(`<span class="text-gray-300">|</span>`); };
  if (personalInfo.portfolio) {
    addContactSep();
    contactParts.push(`<a href="${normalizeUrl(personalInfo.portfolio)}" target="_blank" class="text-blue-700 hover:underline">${e(personalInfo.portfolio)}</a>`);
  }
  if (personalInfo.github) {
    addContactSep();
    contactParts.push(`<a href="${normalizeUrl(personalInfo.github)}" target="_blank" class="text-blue-700 hover:underline">${e(personalInfo.github)}</a>`);
  }
  if (personalInfo.linkedin) {
    addContactSep();
    contactParts.push(`<a href="${normalizeUrl(personalInfo.linkedin)}" target="_blank" class="text-blue-700 hover:underline">${e(personalInfo.linkedin)}</a>`);
  }
  addContactSep();
  contactParts.push(`<a href="mailto:${e(personalInfo.email)}" class="hover:text-blue-700 hover:underline">${e(personalInfo.email)}</a>`);
  addContactSep();
  contactParts.push(`<a href="tel:${e(personalInfo.phone)}" class="hover:text-blue-700 hover:underline">${e(personalInfo.phone)}</a>`);
  addContactSep();
  contactParts.push(`<span>${e(personalInfo.location)}</span>`);

  const header = `
    <div class="border-b-4 border-blue-800 pb-4 mb-5">
      <h1 class="text-3xl font-bold text-blue-800 tracking-wide" style="letter-spacing:0.04em">${e(personalInfo.name)}</h1>
      <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
        ${contactParts.join("\n        ")}
      </div>
    </div>`;

  // ── Summary ──────────────────────────────────────────────────────────────
  const summarySection = summary ? `
    <div class="mb-5">
      ${sectionTitle("Professional Summary")}
      <p class="text-[11.5px] text-gray-700 leading-relaxed">${e(summary)}</p>
    </div>` : "";

  // ── Experience ────────────────────────────────────────────────────────────
  let expSection = "";
  if (experience?.length) {
    const items = experience.map((exp) => `
        <div>
          <div class="flex justify-between items-start">
            <div>
              <p class="text-[12px] font-bold text-gray-900">${e(exp.title)}</p>
              <p class="text-[11.5px] font-semibold text-blue-700">${e(exp.company)}</p>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
              <p class="text-[10.5px] text-gray-500 whitespace-nowrap">${e(exp.startDate)} – ${e(exp.endDate)}</p>
              <p class="text-[10.5px] text-gray-500">${e(exp.location)}</p>
            </div>
          </div>
          <ul class="mt-1.5 space-y-1">
            ${(exp.bullets || []).filter((b) => b.trim()).map(bulletItem).join("")}
          </ul>
        </div>`).join("");
    expSection = `
    <div class="mb-5">
      ${sectionTitle("Work Experience")}
      <div class="space-y-4">${items}
      </div>
    </div>`;
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  let skillsSection = "";
  if (skills) {
    const rows: string[] = [];
    const addRow = (label: string, items?: string[]) => {
      if (items?.length) rows.push(
        `<div class="flex text-[11px]"><span class="font-bold text-gray-800 w-28 flex-shrink-0">${label}:</span><span class="text-gray-700">${e(items.join(" • "))}</span></div>`
      );
    };
    addRow("Languages",  skills.technical);
    addRow("Frameworks", skills.frameworks);
    addRow("Databases",  skills.databases);
    addRow("Cloud",      skills.cloud);
    addRow("Tools",      skills.tools);
    addRow("Soft Skills",skills.soft);
    if (rows.length) {
      skillsSection = `
    <div class="mb-5">
      ${sectionTitle("Technical Skills")}
      <div class="space-y-1">
        ${rows.join("\n        ")}
      </div>
    </div>`;
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  let projectsSection = "";
  if (projects?.length) {
    const items = projects.map((proj) => {
      const links: string[] = [];
      if (proj.link && /[./]/.test(proj.link)) links.push(`<a href="${normalizeUrl(proj.link)}" target="_blank" class="text-[10px] text-blue-700 hover:underline">Link</a>`);
      if (proj.github) links.push(`<a href="${normalizeUrl(proj.github)}" target="_blank" class="text-[10px] text-blue-700 hover:underline">${e(proj.github)}</a>`);
      return `
        <div>
          <div class="flex justify-between items-start gap-3">
            <p class="text-[12px] font-bold text-gray-900">${e(proj.name)}</p>
            <div class="flex items-center gap-2 flex-shrink-0">${links.join("")}</div>
          </div>
          ${proj.description ? `<p class="text-[11px] text-gray-600 italic mb-1">${e(proj.description)}</p>` : ""}
          ${proj.technologies?.length ? `<p class="text-[10.5px] text-gray-500 mb-1"><span class="font-semibold">Tech:</span> ${e(proj.technologies.join(" • "))}</p>` : ""}
          <ul class="space-y-1">
            ${(proj.bullets || []).filter((b) => b.trim()).map(bulletItem).join("")}
          </ul>
        </div>`;
    }).join("");
    projectsSection = `
    <div class="mb-5">
      ${sectionTitle("Projects")}
      <div class="space-y-3">${items}
      </div>
    </div>`;
  }

  // ── Education ─────────────────────────────────────────────────────────────
  let eduSection = "";
  if (education?.length) {
    const items = education.map((edu) => {
      const degree = edu.degree && edu.field
        ? `${edu.degree} in ${edu.field}`
        : edu.degree || edu.field || "";
      return `
        <div class="flex justify-between items-start">
          <div>
            <p class="text-[12px] font-bold text-gray-900">${e(degree)}</p>
            <p class="text-[11.5px] font-semibold text-blue-700">${e(edu.institution)}</p>
            ${edu.cgpa ? `<p class="text-[10.5px] text-gray-600">CGPA: ${e(edu.cgpa)}</p>` : ""}
            ${(edu.honors || []).map((h) => `<p class="text-[10.5px] text-gray-600">${e(h)}</p>`).join("")}
          </div>
          <div class="text-right flex-shrink-0 ml-4">
            <p class="text-[10.5px] text-gray-500">${edu.startDate && edu.endDate ? `${e(edu.startDate)} – ${e(edu.endDate)}` : e(edu.startDate || edu.endDate || "")}</p>
            ${edu.location && !edu.institution?.toLowerCase().includes(edu.location.toLowerCase()) ? `<p class="text-[10.5px] text-gray-500">${e(edu.location)}</p>` : ""}
          </div>
        </div>`;
    }).join("");
    eduSection = `
    <div class="mb-5">
      ${sectionTitle("Education")}
      ${items}
    </div>`;
  }

  // ── Certifications / Achievements ─────────────────────────────────────────
  let certSection = "";
  if (certifications?.length) {
    const items = [...certifications].sort((a, b) => parseCertDate(b.date) - parseCertDate(a.date)).map((cert) => `
        <div class="flex justify-between items-start">
          <div>
            <p class="text-[11.5px] font-bold text-gray-900">${e(cert.name)}</p>
            ${cert.issuer ? `<p class="text-[11px] text-gray-600">${e(cert.issuer)}</p>` : ""}
            ${cert.description ? `<p class="text-[11px] text-gray-600 italic">${e(cert.description)}</p>` : ""}
          </div>
          ${cert.date ? `<div class="text-right flex-shrink-0 ml-4"><p class="text-[10.5px] text-gray-500">${e(cert.date)}</p></div>` : ""}
        </div>`).join("");
    certSection = `
    <div class="mb-5">
      ${sectionTitle("Academic and Extracurricular Achievements")}
      <div class="space-y-1.5">${items}
      </div>
    </div>`;
  }

  const body = `<div id="resume-preview" class="bg-white text-gray-900" style="font-family:Arial,Helvetica,sans-serif">
    ${header}
    ${summarySection}
    ${expSection}
    ${skillsSection}
    ${projectsSection}
    ${eduSection}
    ${certSection}
</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${e(personalInfo.name)} - Resume</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; background: white; }
  </style>
</head>
<body>${body}</body>
</html>`;
}
