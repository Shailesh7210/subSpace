// src/stages/prospeo.ts

import dotenv from "dotenv";
dotenv.config();

const PROSPEO_API_KEY = process.env.PROSPEO_API_KEY!;
const SEARCH_URL = "https://api.prospeo.io/search-person";

const TARGET_SENIORITIES = [
  "C-Suite",
  "Founder/Owner",
  "Director",
  "Partner",
  "Head",
  "Manager",
];

// sleep helper to respect rate limits
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
    // 429 = rate limited, throw so caller can retry
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

export async function findDecisionMakers(domains: string[]) {
  console.log(`\n👥 [Prospeo] Finding decision-makers for ${domains.length} companies...`);

  const allContacts: any[] = [];

  for (const domain of domains) {
    console.log(`  🔎 Searching: ${domain}`);

    try {
      const results = await fetchContactsForDomain(domain);

      for (const result of results) {
        const person = result.person;
        if (!person) continue;

        // only include contacts that have a linkedin url
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
        // retry once
        try {
          const results = await fetchContactsForDomain(domain);
          allContacts.push(...results);
        } catch {
          console.warn(`  ❌ Skipping ${domain} after retry`);
        }
      } else {
        console.warn(`  ❌ Skipping ${domain}: ${err.message}`);
      }
    }

    // 1 second between each domain to respect rate limits
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
  return deduped;
}