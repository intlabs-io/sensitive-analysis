import type { GenerateContentResult } from '@google-cloud/vertexai';

import type { VertexAIContent, VertexAITextPart } from './types';

/**
 * Extracts text content from a Vertex AI GenerateContentResult response.
 * Handles various response formats and provides detailed debugging in development.
 *
 * @param result - The result from model.generateContent()
 * @returns The extracted text content
 * @throws Error if no text content can be extracted
 */
export function extractTextFromVertexAIResponse(
  result: GenerateContentResult,
): string {
  // Resolve candidate up-front with full guarding
  const candidate = result.response?.candidates?.[0];

  // Enhanced debugging for development only
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('=== VERTEX AI RESPONSE DEBUG ===');
    // eslint-disable-next-line no-console
    console.log('Response structure:', {
      hasResponse: !!result.response,
      candidateCount: result.response?.candidates?.length ?? 0,
      firstCandidateKeys: candidate ? Object.keys(candidate) : [],
      firstCandidateContentKeys: candidate?.content
        ? Object.keys(candidate.content)
        : [],
      partsCount: candidate?.content?.parts?.length ?? 0,
    });
  }
  if (!candidate) {
    throw new Error('No candidates found in Vertex AI response');
  }

  let responseText = '';

  // Method 1: Join all text parts in order
  if (
    candidate.content &&
    typeof candidate.content === 'object' &&
    'parts' in candidate.content &&
    candidate.content.parts?.length
  ) {
    const content = candidate.content as VertexAIContent;
    const texts = content.parts
      .map((part: VertexAITextPart | string) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return typeof part.text === 'string' ? part.text : '';
        }
        return '';
      })
      .filter((t): t is string => Boolean(t));
    if (texts.length) {
      responseText = texts.join('');
      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.SENSITIVE_ANALYSIS_DEBUG === '1'
      ) {
        // eslint-disable-next-line no-console
        console.log('✅ Method 1 (joined parts.text) worked');
      }
    }
  }
  // Method 2: Direct content access if it's a string
  else if (typeof candidate.content === 'string') {
    responseText = candidate.content;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('✅ Method 2 (direct content string) worked');
    }
  }
  // Method 3: Iterate parts to find first usable text (fallback)
  else if (
    candidate.content &&
    typeof candidate.content === 'object' &&
    'parts' in candidate.content &&
    candidate.content.parts
  ) {
    const content = candidate.content as VertexAIContent;
    for (const part of content.parts) {
      if (typeof part === 'object' && part && 'text' in part) {
        const textPart = part as VertexAITextPart;
        if (typeof textPart.text === 'string' && textPart.text) {
          responseText = textPart.text;
          if (
            process.env.NODE_ENV !== 'production' &&
            process.env.SENSITIVE_ANALYSIS_DEBUG === '1'
          ) {
            // eslint-disable-next-line no-console
            console.log('✅ Method 3 (iterating parts for text) worked');
          }
          break;
        }
      }
      // Sometimes the part itself might be a string
      if (typeof part === 'string') {
        responseText = part;
        if (
          process.env.NODE_ENV !== 'production' &&
          process.env.SENSITIVE_ANALYSIS_DEBUG === '1'
        ) {
          // eslint-disable-next-line no-console
          console.log('✅ Method 3b (part as string) worked');
        }
        break;
      }
    }
  }

  if (!responseText) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('❌ Could not extract response text from any method');
      // eslint-disable-next-line no-console
      console.log(
        'Full response for debugging:',
        JSON.stringify(result.response, null, 2),
      );
    }
    throw new Error('Could not extract response text from Vertex AI response');
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`Final extracted response text length: ${responseText.length}`);
    // eslint-disable-next-line no-console
    console.log('=== END DEBUG ===');
  }

  return responseText;
}
