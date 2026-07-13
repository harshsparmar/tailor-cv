import nodemailer from "nodemailer";

// ponytail: module-level singleton, fine for a single-instance Next.js server
let transporter: nodemailer.Transporter | null = null;

export function getMailer() {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not configured");
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}
