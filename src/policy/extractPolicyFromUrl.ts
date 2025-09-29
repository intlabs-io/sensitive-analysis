'use server';

import FirecrawlApp from '@mendable/firecrawl-js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { PolicyExtractResponse, PolicyExtractResultSchema } from './types';

/**
 * Extract policy guidelines from a URL using Firecrawl's extract API
 * @param url - The URL to extract policy information from
 * @returns Promise containing the extracted policy data
 */
export async function extractPolicyFromUrl(
  url: string,
  policyId: string,
): Promise<PolicyExtractResponse> {
  try {
    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only http/https URLs are allowed');
      }
    } catch {
      throw new Error('Invalid URL');
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }

    const app = new FirecrawlApp({
      apiKey: apiKey,
    });

    const prompt = `
REF:website link
${url}

Instructions:
Please read the entire webpage and explore the provided links to locate the relevant information. Your task is to extract specific passages from the text that directly address the following:
- The definition of "personal information" and what fields are included in the definition as per the Privacy Act.
- The definition of "sensitive information" and what fields are included in the definition as per the Privacy Act or Company Policy Act.
- Identification of the individuals or entities covered and protected by this Act.
- A clear list or description of the rights and privileges individuals hold concerning their personal data.

If the text does not answer any of the above questions, do not include it in your response.
Copy and paste the exact excerpts that match the above criteria without adding any personal interpretations or summaries. Ensure the snippets are concise and directly related to the requested topics.

Response: Create an array for each snippet/excerpt in the following object (examples are provided to help you understand the format and context, please do not include them in your response):
The response can be empty if there are no defined sections or snippets that match the requested topics.
title: The title of the section, sub-section, and header the sensitive instruction is found in.
Examples: 'Section (Part) # — Collection of Personal Information', 'Section # — Use of Personal Information'
snippet: A snippet of the text that contains the sensitive instructions or references to sensitive information in a document.
Examples: '(#/letter) you are not to display personal information', '(#/letter) a business license is considered sensitive information'
    `;

    const result = await app.extract({
      urls: [url],
      prompt: prompt,
      schema: zodToJsonSchema(PolicyExtractResultSchema, 'PolicyExtractResult'),
      enableWebSearch: true, // Enable web search for more comprehensive results
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract policy data');
    }

    const parsed = PolicyExtractResultSchema.safeParse(result.data);
    if (!parsed.success) {
      throw new Error('Schema validation failed for extracted policy data');
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (error) {
    console.error('Error in extractPolicyFromUrl:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
