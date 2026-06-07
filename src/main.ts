// src/main.ts

import * as readline from "readline";
import { findLookalikeCompanies } from "./stages/ocean.js";
import { findDecisionMakers } from "./stages/prospeo.js";
import { sendOutreachEmails } from "./stages/brevo.js";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("\nEnter seed company domain (e.g. stripe.com): ", async (domain) => {
    rl.close();

    try {
      // Stage 1 — Ocean.io
      const domains = await findLookalikeCompanies(domain.trim());

      if (domains.length === 0) {
        console.log("⚠️  No lookalike companies found — exiting.");
        return;
      }

      // Stage 2 — Prospeo (contacts + emails)
      const contacts = await findDecisionMakers(domains);

      if (contacts.length === 0) {
        console.log("⚠️  No contacts with verified emails found — exiting.");
        return;
      }

      // Stage 3 — Brevo (send emails with safety checkpoint)
      await sendOutreachEmails(contacts);

    } catch (err: any) {
      console.error("❌ Pipeline error:", err.message);
    }
  });
}

main();