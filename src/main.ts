// src/main.ts

import * as readline from "readline";
import { findLookalikeCompanies } from "./stages/ocean.js";
import { findDecisionMakers } from "./stages/prospeo.js";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("\nEnter seed company domain (e.g. stripe.com): ", async (domain) => {
    rl.close();

    try {
      // Stage 1
      const domains = await findLookalikeCompanies(domain.trim());

      // Stage 2
      const contacts = await findDecisionMakers(domains);

      console.log(`\n📦 Stage 2 complete — ${contacts.length} contacts ready for Stage 3`);
      console.table(
        contacts.map((c) => ({
          Name: c.fullName,
          Title: c.title,
          Company: c.company,
          LinkedIn: c.linkedinUrl,
        }))
      );
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });
}

main();