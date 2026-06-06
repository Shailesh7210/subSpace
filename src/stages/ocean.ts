// src/stages/ocean.ts

import dotenv from "dotenv";
dotenv.config();

const OCEAN_API_TOKEN = process.env.OCEAN_API_KEY!;
const OCEAN_API_URL = "https://api.ocean.io/v3/search/companies";

export async function findLookalikeCompanies(
  seedDomain: string,
  limit: number = 10
): Promise<string[]> {
  console.log(`\n🔍 [Ocean.io] Finding lookalike companies for: ${seedDomain}`);

  const response = await fetch(OCEAN_API_URL, {
    method: "POST",
    headers: {
      "x-api-token": OCEAN_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      size: limit,
      companiesFilters: {
        lookalikeDomains: [seedDomain],
        excludeDomains: [seedDomain], // exclude the seed itself
      },
      fields: ["domain", "name", "companySize", "primaryCountry", "industries"],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Ocean.io API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  if (!data.companies || data.companies.length === 0) {
    console.warn("⚠️  No lookalike companies found.");
    return [];
  }

  const domains: string[] = data.companies
    .map((entry: any) => entry.company?.domain || entry.domain)
    .filter(Boolean);

  console.log(`✅ Found ${domains.length} lookalike companies:`);
  domains.forEach((d) => console.log(`   → ${d}`));

  return domains;
}