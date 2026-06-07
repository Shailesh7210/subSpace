// src/stages/prospeo.ts

import dotenv from "dotenv";
dotenv.config();

const PROSPEO_API_KEY = process.env.PROSPEO_API_KEY!;
const SEARCH_URL = "https://api.prospeo.io/search-person";
const ENRICH_URL = "https://api.prospeo.io/enrich-person";

const TARGET_SENIORITIES = [
  "C-Suite",
  "Founder/Owner",
  "Director",
  "Partner",
  "Head",
  "Manager",
];

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchContactsForDomain(domain: string): Promise<any[]> {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KEY": PROSPEO_API_KEY,
    },
    body: JSON.stringify({
      page: 1,
      filters: {
        company: {
          websites: {
            include: [domain],
          },
        },
        person_seniority: {
          include: TARGET_SENIORITIES,
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    if (response.status === 429) throw new Error("RATE_LIMITED");
    console.warn(`  ⚠️  Prospeo error for ${domain}: ${JSON.stringify(err)}`);
    return [];
  }

  const data = await response.json();
  if (data.error) {
    if (data.error_code === "NO_RESULTS") return [];
    console.warn(`  ⚠️  No results for ${domain}: ${data.error_code}`);
    return [];
  }

  return data.results || [];
}

async function enrichPersonEmail(personId: string): Promise<string | null> {
  const response = await fetch(ENRICH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KEY": PROSPEO_API_KEY,
    },
    body: JSON.stringify({
      only_verified_email: true,
      data: {
        person_id: personId,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (err.error_code === "INSUFFICIENT_CREDITS") throw new Error("INSUFFICIENT_CREDITS");
    return null;
  }

  const data = await response.json();
  if (data.error) return null;

  const email = data.person?.email;
  if (!email || !email.revealed || !email.email) return null;

  return email.email;
}

export async function findDecisionMakers(domains: string[]): Promise<any[]> {
  console.log(`\n👥 [Prospeo] Finding decision-makers for ${domains.length} companies...`);

  const allContacts: any[] = [];

  for (const domain of domains) {
    console.log(`  🔎 Searching: ${domain}`);

    try {
      const results = await fetchContactsForDomain(domain);

      for (const result of results) {
        const person = result.person;
        if (!person) continue;
        if (!person.linkedin_url) continue;

        allContacts.push({
          personId: person.person_id,
          fullName: person.full_name || `${person.first_name} ${person.last_name}`,
          firstName: person.first_name || "",
          lastName: person.last_name || "",
          title: person.current_job_title || "",
          linkedinUrl: person.linkedin_url,
          company: result.company?.name || domain,
          domain,
        });
      }

      console.log(`  ✅ ${domain} → ${results.length} contacts found`);
    } catch (err: any) {
      if (err.message === "RATE_LIMITED") {
        console.warn(`  ⏳ Rate limited — waiting 60s...`);
        await sleep(60000);
      } else {
        console.warn(`  ❌ Skipping ${domain}: ${err.message}`);
      }
    }

    await sleep(1000);
  }

  // deduplicate by linkedinUrl
  const seen = new Set<string>();
  const deduped = allContacts.filter((c) => {
    if (seen.has(c.linkedinUrl)) return false;
    seen.add(c.linkedinUrl);
    return true;
  });

  console.log(`\n✅ Stage 2 complete — ${deduped.length} unique decision-makers found`);
  console.log(`\n📧 [Prospeo] Enriching emails for ${deduped.length} contacts...`);

  const enriched: any[] = [];

  for (const contact of deduped) {
    console.log(`  🔍 Enriching: ${contact.fullName}`);

    try {
      const email = await enrichPersonEmail(contact.personId);

      if (email) {
        enriched.push({ ...contact, email });
        console.log(`  ✅ ${contact.fullName} → ${email}`);
      } else {
        console.log(`  ⚠️  No verified email for ${contact.fullName} — skipping`);
      }
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_CREDITS") {
        console.error("  ❌ Insufficient Prospeo credits — stopping enrichment");
        break;
      }
      if (err.message === "RATE_LIMITED") {
        console.warn(`  ⏳ Rate limited — waiting 60s...`);
        await sleep(60000);
      } else {
        console.warn(`  ❌ Skipping ${contact.fullName}: ${err.message}`);
      }
    }

    await sleep(500);
  }

  // deduplicate by email
  const emailSeen = new Set<string>();
  const finalContacts = enriched.filter((c) => {
    if (emailSeen.has(c.email)) return false;
    emailSeen.add(c.email);
    return true;
  });

  console.log(`\n✅ Email enrichment complete — ${finalContacts.length} contacts with verified emails`);
  return finalContacts;
}