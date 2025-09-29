import { z } from 'zod';

export interface PolicyNode {
  title: string;
  snippet: string;
}

export interface PolicyExtractResult {
  node: PolicyNode[];
}

export interface PolicyExtractResponse {
  success: boolean;
  data?: PolicyExtractResult;
  error?: string;
}

// Define the schema using Zod
export const PolicyNodeSchema = z.object({
  title: z.string(),
  snippet: z.string(),
});

export const PolicyExtractResultSchema = z.object({
  node: z.array(PolicyNodeSchema),
});
