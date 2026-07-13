import puppeteer from "puppeteer";
import { buildResumeHtml } from "@/lib/resume-html-template";
import type { ResumeData } from "@/types/resume";

export async function generateResumePdf(resume: ResumeData) {
  const html = buildResumeHtml(resume);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // prevents crashes in containers with small /dev/shm
      "--disable-gpu",
    ],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  // Give Tailwind CDN time to generate styles
  await new Promise((r) => setTimeout(r, 1500));

  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();

  return pdf;
}
