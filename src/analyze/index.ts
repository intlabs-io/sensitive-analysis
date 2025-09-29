import { PolicyFragment } from '../types';

import type { AnalysisEventData, AnalysisTypeEnum } from '../types';
import { Workflow } from './workflow';

/**
 * Main entry point for sensitive analysis
 *
 * @example
 * ```typescript
 * import { analyzeSensitiveContent } from './index';
 *
 * const result = await analyzeSensitiveContent({
 *   content: "John Doe's SSN is 123-45-6789",
 *   analysisType: 'UNSTRUCTURED',
 *   policies: [{ id: 'policy1', name: 'PII Protection Policy' } as PolicyFragment],
 * }, (type, data) => {
 *   console.log('Event:', type, data);
 * });
 *
 * console.log('Found entities:', result.entities);
 * console.log('Processing stats:', result.stats);
 * ```
 *
 * The workflow implements a pipeline pattern:
 * 1. **Chunking**: Split content into overlapping chunks based on analysis type
 * 2. **Identification**: Concurrently identify entities using LLM tools and policies
 * 3. **Validation**: Filter entities based on confidence thresholds
 * 4. **Deduplication**: Remove duplicate entities using various strategies
 */

/**
 * Streaming analysis function - directly streams to event callback
 */
export async function analyzeSensitiveContent(
  params: {
    content: string;
    analysisType: AnalysisTypeEnum;
    policies: PolicyFragment[];
  },
  onEvent: (
    type: 'thinking' | 'complete' | 'error',
    data: AnalysisEventData,
  ) => void,
): Promise<void> {
  const workflow = new Workflow();

  const job = {
    content: params.content,
    analysisType: params.analysisType as AnalysisTypeEnum,
    policies: params.policies,
  };

  try {
    // Execute workflow with direct streaming to event callback
    const result = await workflow.execute(job, (event) => {
      // Forward streaming events directly to the event stream
      onEvent(event.type, event.data);
    });

    // Send final completion event
    onEvent('complete', {
      entities: result.entities,
      stats: result.stats,
    });
  } catch (error) {
    onEvent('error', {
      message: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
}
