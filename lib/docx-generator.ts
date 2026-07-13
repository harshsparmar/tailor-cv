import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  UnderlineType,
  ExternalHyperlink,
  TabStopType,
} from "docx";
import type { ResumeData } from "@/types/resume";

// Matching resume-html-template.ts color palette exactly
const BLUE_800 = "1E40AF";
const BLUE_700 = "1D4ED8";
const GRAY_900 = "111827";
const GRAY_700 = "374151";
const GRAY_600 = "4B5563";
const GRAY_500 = "6B7280";

// px → docx half-points (px * 1.5)
const SZ_NAME    = 45; // text-3xl  30px
const SZ_TITLE   = 18; // text-[12px]
const SZ_COMPANY = 17; // text-[11.5px]
const SZ_BODY    = 17; // text-[11px]
const SZ_META    = 16; // text-[10.5px]
const SZ_SECTION = 17; // text-[11px] uppercase section heading

const FONT = "Arial";

// Tab stop at the right edge of the content area
// Letter page (12240 twips) - left margin 900 - right margin 900 = 10440 twips content width
const TAB_RIGHT = 10440;

function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function dateRange(start: string, end: string): string {
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

/** Blue underline section heading matching border-b-2 border-blue-800 */
function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        font: FONT,
        size: SZ_SECTION,
        color: BLUE_800,
      }),
    ],
    spacing: { before: 180, after: 80 },
    border: {
      bottom: {
        color: BLUE_800,
        space: 4,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
  });
}

function bulletPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SZ_BODY, color: GRAY_700 })],
    bullet: { level: 0 },
    spacing: { after: 30 },
  });
}

function metaPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SZ_META, color: GRAY_600 })],
    spacing: { after: 20 },
  });
}

function skillRow(label: string, items: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, font: FONT, size: SZ_BODY, color: GRAY_900 }),
      new TextRun({ text: items.join(" • "), font: FONT, size: SZ_BODY, color: GRAY_700 }),
    ],
    spacing: { after: 40 },
  });
}

const CERT_MONTHS: Record<string, number> = {
  Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12
};
function parseCertDate(date: string): number {
  if (!date) return 0;
  const m = date.match(/^([A-Za-z]{3})[^A-Za-z0-9](\d{2,4})$/);
  if (m) {
    const yr = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    return yr * 100 + (CERT_MONTHS[m[1]] ?? 0);
  }
  return date.match(/^\d{4}$/) ? parseInt(date) * 100 : 0;
}

export async function generateDOCX(
  resume: ResumeData,
  jobTitle: string,
  company: string
): Promise<Buffer> {
  const { personalInfo, summary, experience, education, skills, projects, certifications } = resume;

  const children: Paragraph[] = [];

  // ── Name ─────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: personalInfo.name, bold: true, font: FONT, size: SZ_NAME, color: BLUE_800 }),
      ],
      spacing: { after: 60 },
    })
  );

  // ── Contact row ───────────────────────────────────────────────────────────
  const contactChildren: (TextRun | ExternalHyperlink)[] = [];
  const sep = () => new TextRun({ text: "  |  ", font: FONT, size: SZ_META, color: GRAY_600 });
  const addSep = () => { if (contactChildren.length > 0) contactChildren.push(sep()); };

  if (personalInfo.portfolio) {
    addSep();
    contactChildren.push(new ExternalHyperlink({
      link: toAbsoluteUrl(personalInfo.portfolio),
      children: [new TextRun({ text: personalInfo.portfolio, font: FONT, size: SZ_META, color: BLUE_700, underline: { type: UnderlineType.SINGLE } })],
    }));
  }
  if (personalInfo.github) {
    addSep();
    contactChildren.push(new ExternalHyperlink({
      link: toAbsoluteUrl(personalInfo.github),
      children: [new TextRun({ text: personalInfo.github, font: FONT, size: SZ_META, color: BLUE_700, underline: { type: UnderlineType.SINGLE } })],
    }));
  }
  if (personalInfo.linkedin) {
    addSep();
    contactChildren.push(new ExternalHyperlink({
      link: toAbsoluteUrl(personalInfo.linkedin),
      children: [new TextRun({ text: personalInfo.linkedin, font: FONT, size: SZ_META, color: BLUE_700, underline: { type: UnderlineType.SINGLE } })],
    }));
  }
  if (personalInfo.email) {
    addSep();
    contactChildren.push(new ExternalHyperlink({
      link: `mailto:${personalInfo.email}`,
      children: [new TextRun({ text: personalInfo.email, font: FONT, size: SZ_META, color: GRAY_600 })],
    }));
  }
  if (personalInfo.phone) {
    addSep();
    contactChildren.push(new TextRun({ text: personalInfo.phone, font: FONT, size: SZ_META, color: GRAY_600 }));
  }
  if (personalInfo.location) {
    addSep();
    contactChildren.push(new TextRun({ text: personalInfo.location, font: FONT, size: SZ_META, color: GRAY_600 }));
  }

  children.push(
    new Paragraph({
      children: contactChildren,
      spacing: { after: 140 },
      border: {
        bottom: { color: BLUE_800, style: BorderStyle.SINGLE, size: 24, space: 6 },
      },
    })
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  if (summary) {
    children.push(sectionHeading("Professional Summary"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: summary, font: FONT, size: SZ_BODY, color: GRAY_700 })],
        spacing: { after: 120 },
      })
    );
  }

  // ── Work Experience ───────────────────────────────────────────────────────
  if (experience?.length) {
    children.push(sectionHeading("Work Experience"));
    for (const exp of experience) {
      const expDate = dateRange(exp.startDate, exp.endDate);

      // Title (left) | Date (right)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.title, bold: true, font: FONT, size: SZ_TITLE, color: GRAY_900 }),
            new TextRun({ text: "\t", font: FONT, size: SZ_META }),
            new TextRun({ text: expDate, font: FONT, size: SZ_META, color: GRAY_500, italics: true }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          spacing: { after: 20 },
        })
      );

      // Company (left) | Location (right)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.company, bold: true, font: FONT, size: SZ_COMPANY, color: BLUE_700 }),
            ...(exp.location ? [
              new TextRun({ text: "\t", font: FONT, size: SZ_META }),
              new TextRun({ text: exp.location, font: FONT, size: SZ_META, color: GRAY_500, italics: true }),
            ] : []),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          spacing: { after: 60 },
        })
      );

      for (const bullet of exp.bullets.filter((b) => b.trim())) {
        children.push(bulletPara(bullet));
      }
      children.push(new Paragraph({ spacing: { after: 100 } }));
    }
  }

  // ── Technical Skills ──────────────────────────────────────────────────────
  if (skills) {
    children.push(sectionHeading("Technical Skills"));
    if (skills.technical?.length)  children.push(skillRow("Languages",  skills.technical));
    if (skills.frameworks?.length) children.push(skillRow("Frameworks", skills.frameworks));
    if (skills.databases?.length)  children.push(skillRow("Databases",  skills.databases));
    if (skills.cloud?.length)      children.push(skillRow("Cloud",      skills.cloud));
    if (skills.tools?.length)      children.push(skillRow("Tools",      skills.tools));
    if (skills.soft?.length)       children.push(skillRow("Soft Skills",skills.soft));
    children.push(new Paragraph({ spacing: { after: 100 } }));
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  if (projects?.length) {
    children.push(sectionHeading("Projects"));
    for (const proj of projects) {
      const headerRuns: (TextRun | ExternalHyperlink)[] = [
        new TextRun({ text: proj.name, bold: true, font: FONT, size: SZ_TITLE, color: GRAY_900 }),
      ];
      const hasLinks = !!(proj.link || proj.github);
      if (hasLinks) {
        headerRuns.push(new TextRun({ text: "\t", font: FONT, size: SZ_META }));
        if (proj.link) {
          headerRuns.push(
            new ExternalHyperlink({
              link: toAbsoluteUrl(proj.link),
              children: [
                new TextRun({ text: "Link", font: FONT, size: SZ_META, color: BLUE_700, underline: { type: UnderlineType.SINGLE } }),
              ],
            })
          );
        }
        if (proj.github) {
          if (proj.link) headerRuns.push(new TextRun({ text: "  ", font: FONT, size: SZ_META }));
          headerRuns.push(
            new ExternalHyperlink({
              link: toAbsoluteUrl(proj.github),
              children: [
                new TextRun({ text: proj.github, font: FONT, size: SZ_META, color: BLUE_700, underline: { type: UnderlineType.SINGLE } }),
              ],
            })
          );
        }
      }
      children.push(new Paragraph({
        children: headerRuns,
        tabStops: hasLinks ? [{ type: TabStopType.RIGHT, position: TAB_RIGHT }] : [],
        spacing: { after: 25 },
      }));

      if (proj.description?.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: proj.description, font: FONT, size: SZ_META, color: GRAY_600, italics: true })],
            spacing: { after: 25 },
          })
        );
      }
      if (proj.technologies?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Tech: ", bold: true, font: FONT, size: SZ_META, color: GRAY_900 }),
              new TextRun({ text: proj.technologies.join(" • "), font: FONT, size: SZ_META, color: GRAY_500 }),
            ],
            spacing: { after: 40 },
          })
        );
      }
      for (const bullet of proj.bullets.filter((b) => b.trim())) {
        children.push(bulletPara(bullet));
      }
      children.push(new Paragraph({ spacing: { after: 100 } }));
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  if (education?.length) {
    children.push(sectionHeading("Education"));
    for (const edu of education) {
      const degreeText = edu.degree && edu.field
        ? `${edu.degree} in ${edu.field}`
        : edu.degree || edu.field || "";
      const eduDate = dateRange(edu.startDate, edu.endDate);
      const showLoc = edu.location && !edu.institution?.toLowerCase().includes(edu.location.toLowerCase());

      // Degree (left) | Date (right)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: degreeText, bold: true, font: FONT, size: SZ_TITLE, color: GRAY_900 }),
            ...(eduDate ? [
              new TextRun({ text: "\t", font: FONT, size: SZ_META }),
              new TextRun({ text: eduDate, font: FONT, size: SZ_META, color: GRAY_500, italics: true }),
            ] : []),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          spacing: { after: 20 },
        })
      );

      // Institution (left) | Location (right, only if not already in institution name)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.institution, bold: true, font: FONT, size: SZ_COMPANY, color: BLUE_700 }),
            ...(showLoc ? [
              new TextRun({ text: "\t", font: FONT, size: SZ_META }),
              new TextRun({ text: edu.location!, font: FONT, size: SZ_META, color: GRAY_500, italics: true }),
            ] : []),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          spacing: { after: 20 },
        })
      );

      if (edu.cgpa) {
        children.push(metaPara(`CGPA: ${edu.cgpa}`));
      }

      // Honors as plain text (not bulleted) to match HTML template
      for (const honor of edu.honors || []) {
        children.push(metaPara(honor));
      }

      children.push(new Paragraph({ spacing: { after: 100 } }));
    }
  }

  // ── Academic & Extracurricular Achievements ───────────────────────────────
  if (certifications?.length) {
    children.push(sectionHeading("Academic and Extracurricular Achievements"));
    const sorted = [...certifications].sort((a, b) => parseCertDate(b.date) - parseCertDate(a.date));
    for (const cert of sorted) {
      // Name (left) | Date (right)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: cert.name, bold: true, font: FONT, size: SZ_BODY, color: GRAY_900 }),
            ...(cert.date ? [
              new TextRun({ text: "\t", font: FONT, size: SZ_META }),
              new TextRun({ text: cert.date, font: FONT, size: SZ_META, color: GRAY_500, italics: true }),
            ] : []),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          spacing: { after: 20 },
        })
      );

      if (cert.issuer) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: cert.issuer, font: FONT, size: SZ_META, color: GRAY_600 })],
            spacing: { after: cert.description ? 10 : 30 },
          })
        );
      }

      if (cert.description) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: cert.description, font: FONT, size: SZ_META, color: GRAY_600, italics: true })],
            spacing: { after: 30 },
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: personalInfo.name,
    title: `${personalInfo.name} - Resume - ${jobTitle} at ${company}`,
    description: "ATS-optimized resume generated by Resume Optimizer",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SZ_BODY, color: GRAY_700 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
