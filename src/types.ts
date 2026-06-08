// src/types.ts

export interface Company {
  domain: string;
  name?: string;
  companySize?: string;
  primaryCountry?: string;
  industries?: string[];
}

export interface Contact {
  personId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string;
  company: string;
  domain: string;
}

export interface ContactWithEmail extends Contact {
  email: string;
}

