'use server';

import { SchemaType, VertexAI } from '@google-cloud/vertexai';

import { extractTextFromVertexAIResponse } from '../vertexAiHelpers';

import { PolicyExtractResponse, PolicyExtractResultSchema } from './types';

// Initialize Vertex AI client
const project = process.env.VERTEX_AI_PROJECT_ID;
const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
if (!project) {
  throw new Error('VERTEX_AI_PROJECT_ID is not set');
}
const vertexAI = new VertexAI({ project, location });

// Get the Gemini model with response schema enforcement
const model = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 8192,
    // Enforce JSON schema directly in Vertex AI
    responseMimeType: 'application/json',
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        node: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              snippet: { type: SchemaType.STRING },
            },
            required: ['title', 'snippet'],
          },
        },
      },
      required: ['node'],
    },
  },
});

export async function extractPolicyFromPdf(
  pdfBuffer: Buffer,
  policyId: string,
): Promise<PolicyExtractResponse> {
  try {
    // Step 1: Process PDF directly with Vertex AI Gemini
    const base64Data = pdfBuffer.toString('base64');

    // Create the multimodal prompt with PDF
    const prompt = `You are a privacy and data regulation lawyer. Extract only direct quotations/snippets that match the requested topics from this PDF document.

Instructions:
Please read the entire provided PDF document. Your task is to extract specific passages from the text that directly address the following:
- The definition of "personal information" and what fields are included in the definition as per the Privacy Act or the document's stated policy.
- The definition of "sensitive information" and what fields are included in the definition as per the Privacy Act or Company Policy Act.
- Identification of the individuals or entities covered and protected by this Act or policy.
- A clear list or description of the rights and privileges individuals hold concerning their personal data.

If the document does not answer any of the above questions, do not include it in your response.
Copy and paste the exact excerpts that match the above criteria without adding any personal interpretations or summaries. Ensure the snippets are concise and directly related to the requested topics.

Return your response as a JSON object with this exact structure:
{
  "node": [
    {
      "title": "Brief descriptive title for this excerpt",
      "snippet": "Exact text from the document"
    }
  ]
}

If no relevant information is found, return: {"node": []}`;

    // Step 2: Generate analysis with Vertex AI Gemini using multimodal input
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
          ],
        },
      ],
    };

    const result = await model.generateContent(request);

    // Extract response text using the helper function
    const responseText = extractTextFromVertexAIResponse(result);

    // With responseSchema enforced, we can directly parse JSON
    // No need for complex regex since Vertex AI guarantees JSON format
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
      );
    }

    // Still validate with Zod for extra safety and type guarantees
    const parseResult = PolicyExtractResultSchema.safeParse(parsed);
    if (!parseResult.success) {
      throw new Error(`Schema validation failed: ${parseResult.error.message}`);
    }
    const data = parseResult.data;

    return {
      success: true,
      data,
    };
  } catch (error) {
    // Log error for debugging
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Error in extractPolicyFromPdf:', error);
    }

    // Try fallback processing if direct PDF processing fails
    if (error instanceof Error && error.message.includes('multimodal')) {
      try {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Attempting fallback text extraction...');
        }
        // You could implement a fallback here using a PDF text extraction library
        // For now, we'll just return the error
      } catch (fallbackError) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Fallback processing also failed:', fallbackError);
        }
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
