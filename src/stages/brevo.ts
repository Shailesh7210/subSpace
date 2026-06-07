// src/stages/brevo.ts

import dotenv from "dotenv";
dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const SENDER_EMAIL = process.env.SENDER_EMAIL!;
const SENDER_NAME = process.env.SENDER_NAME!;
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function buildEmailHtml(contact: any): string {
  return `
<html>
<head></head>
<body style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: auto; padding: 24px;">
  <p>Hi ${contact.firstName || contact.fullName},</p>

  <p>I came across <strong>${contact.company}</strong> and was genuinely impressed by what you're building in the payments space.</p>

  <p>I'm reaching out because we've been helping companies like yours streamline their outreach and sales pipeline — cutting the time spent on manual prospecting by over 60%.</p>

  <p>Given your role as <strong>${contact.title}</strong> at ${contact.company}, I thought this could be directly relevant to your goals this quarter.</p>

  <p>Would you be open to a quick 15-minute call this week to explore if there's a fit?</p>

  <p>
    Best regards,<br/>
    <strong>${SENDER_NAME}</strong><br/>
    ${SENDER_EMAIL}
  </p>
</body>
</html>
  `.trim();
}

async function sendEmail(contact: any): Promise<boolean> {
  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: contact.email,
          name: contact.fullName,
        },
      ],
      subject: `Quick question for you, ${contact.firstName || contact.fullName}`,
      htmlContent: buildEmailHtml(contact),
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.warn(`  ⚠️  Failed to send to ${contact.email}: ${JSON.stringify(err)}`);
    return false;
  }

  return true;
}

export async function sendOutreachEmails(contacts: any[]): Promise<void> {
  console.log(`\n🚀 [Brevo] Preparing to send emails to ${contacts.length} contacts...`);

  // Safety checkpoint
  console.log("\n📋 Summary of contacts about to be emailed:");
  console.table(
    contacts.map((c, i) => ({
      "#": i + 1,
      Name: c.fullName,
      Title: c.title,
      Company: c.company,
      Email: c.email,
    }))
  );

  const { default: inquirer } = await import("inquirer");
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `About to send to ${contacts.length} contacts. Proceed?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log("❌ Cancelled — no emails sent.");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    console.log(`  📤 Sending to: ${contact.fullName} <${contact.email}>`);

    const success = await sendEmail(contact);
    if (success) {
      sent++;
      console.log(`  ✅ Sent to ${contact.email}`);
    } else {
      failed++;
    }

    await sleep(500);
  }

  console.log(`\n✅ Stage 4 complete — ${sent} emails sent, ${failed} failed`);
}