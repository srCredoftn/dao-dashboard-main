import { sendMail } from "../utils/mailer";

const LOGO_URL =
  "https://cdn.builder.io/api/v1/image/assets%2F376e9389c66d473f975258354bf70209%2F9d870cba39fd46d3bb0ed8d14c652440?format=webp&width=400";

function brandWrap(contentHtml: string, title?: string) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; line-height:1.6; color:#111827; background:#f9fafb; padding:16px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06)">
      <div style="padding:16px 16px 0; text-align:center; background:#ffffff;">
        <img src="${LOGO_URL}" alt="2SND Technologies" style="height:40px; margin:0 auto 8px; display:block; background:#ffffff;" />
        ${title ? `<h2 style=\"margin:0 0 12px;\">${title}</h2>` : ""}
      </div>
      <div style="padding:0 16px 16px;">${contentHtml}</div>
      <div style="padding:12px 16px; font-size:12px; color:#6b7280; border-top:1px solid #f3f4f6;">
        © ${new Date().getFullYear()} 2SND Technologies — ${process.env.MAIL_DOMAIN || "2sndtechnologies.com"}
      </div>
    </div>
  </div>`;
}

function buildResetEmailHtml(code: string) {
  const inner = `
    <p>Voici votre code de vérification&nbsp;:</p>
    <div style="display:inline-block; font-size:22px; letter-spacing:4px; font-weight:700; background:#111827; color:#fff; padding:10px 14px; border-radius:8px;">${code}</div>
    <p style="margin-top:16px;">Ce code est valable 15 minutes. Ne le partagez avec personne.</p>
    <p style="font-size:12px;color:#6b7280;margin-top:24px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
  `;
  return brandWrap(inner, "Réinitialisation du mot de passe");
}

export const EmailService = {
  async sendPasswordResetEmail(email: string, code: string) {
    const subject = "Réinitialisation du mot de passe";
    const text = `Code de vérification: ${code}\nValable 15 minutes.`;
    const html = buildResetEmailHtml(code);
    return sendMail({ to: email, subject, text, html });
  },
  async sendNotificationEmail(to: string, subject: string, body: string) {
    const inner = `<p style=\"margin:0; white-space:pre-wrap;\">${body}</p>`;
    const html = brandWrap(inner, subject);
    const text = body;
    return sendMail({ to, subject, text, html });
  },
  async sendBulkNotification(toList: string[], subject: string, body: string) {
    const unique = Array.from(new Set(toList.filter(Boolean)));
    for (const to of unique) {
      try {
        await this.sendNotificationEmail(to, subject, body);
      } catch (_) {}
    }
    return { sent: unique.length };
  },
};
