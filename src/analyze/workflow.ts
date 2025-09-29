import PQueue from 'p-queue';
import { z } from 'zod';

import { PolicyFragment } from '../types';

import type {
  AnalysisTypeEnum,
  ChunkData,
  ProcessingJob,
  SensitiveEntity,
  StreamingEvent,
} from '../types';
import { ChunkerTool } from './chunker';
import { DeduperTool } from './deduper';
import { IdentifierTool } from './identifier';
import { ValidatorTool } from './validator';

// Define the trigger schema for validation
const TriggerSchema = z.object({
  content: z.string().min(1),
  analysisType: z.enum(['UNSTRUCTURED', 'CSV', 'JSON', 'SPREADSHEET']),
  policies: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .min(1),
});

/**
 * Sensitive Analysis Workflow: Main entry point for sensitive analysis
 * Implements a pipeline pattern: Chunk → Identify → Validate → Deduplicate
 */
export class Workflow {
  public chunker: ChunkerTool;
  public identifier: IdentifierTool;
  public validator: ValidatorTool;
  public deduper: DeduperTool;

  constructor() {
    if (!process.env.OPENAI_MODEL) {
      console.warn('OPENAI_MODEL not set, using default: gpt-4o-mini');
    }

    this.chunker = new ChunkerTool();
    this.identifier = new IdentifierTool();
    this.validator = new ValidatorTool({ minimumConfidence: 7 });
    this.deduper = new DeduperTool();
  }

  /**
   * Execute the sensitive analysis workflow
   * Supports optional streaming callback for real-time updates
   */
  async execute(
    job: ProcessingJob,
    onStream: (event: StreamingEvent) => void = () => {},
  ): Promise<{
    entities: SensitiveEntity[];
    chunks: ChunkData[];
    stats: {
      chunksGenerated: number;
      entitiesFound: number;
      entitiesValidated: number;
      entitiesDeduplicated: number;
      processingTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    const queue = new PQueue({ concurrency: 5 });
    let identifiedCount = 0;
    let validatedCount = 0;

    try {
      // Validate input
      const validatedJob = TriggerSchema.parse(job);

      // Step 1: Chunking
      const chunks = await this.executeChunkingStep(validatedJob);

      const tasks = chunks.map((chunk, index) =>
        queue.add(async () => {
          try {
            // Step 2: Identification with streaming
            const entities = await this.executeIdentificationStep(
              chunk,
              validatedJob,
              onStream,
            );

            // Step 3: Validation
            identifiedCount += entities.length;
            const validated = await this.executeValidationStep(entities);
            validatedCount += validated.length;
            return validated;
          } catch (chunkError) {
            console.error(`Error processing chunk ${index + 1}:`, chunkError);
            throw new Error(
              `Chunk ${index + 1} processing failed: ${
                chunkError instanceof Error
                  ? chunkError.message
                  : 'Unknown error'
              }`,
            );
          }
        }),
      );

      const results = (await Promise.all(tasks)).flatMap(
        (result) => result ?? [],
      );

      // Step 4: Deduplication
      const finalEntities = await this.executeDeduplicationStep(
        results,
        job.analysisType,
      );

      // Step 5: Compile results
      return {
        entities: finalEntities,
        chunks,
        stats: {
          chunksGenerated: chunks.length,
          entitiesFound: identifiedCount,
          entitiesValidated: validatedCount,
          entitiesDeduplicated: finalEntities.length,
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = {
        message: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined,
        jobInfo: {
          contentLength: job.content?.length || 0,
          analysisType: job.analysisType,
          policiesCount: job.policies?.length || 0,
        },
      };

      console.error('Sensitive analysis workflow failed:', errorDetails);
      throw new Error(`Sensitive analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Step 1: Chunking
   */
  private async executeChunkingStep(
    job: z.infer<typeof TriggerSchema>,
  ): Promise<ChunkData[]> {
    return await this.chunker.createChunks(
      job.analysisType as AnalysisTypeEnum,
      job.content,
    );
  }

  /**
   * Step 2: Identification (concurrent processing with optional streaming)
   */
  private async executeIdentificationStep(
    chunk: ChunkData,
    job: z.infer<typeof TriggerSchema>,
    onStream: (event: StreamingEvent) => void,
  ): Promise<SensitiveEntity[]> {
    if (!chunk) {
      return [];
    }
    return await this.identifier.identifySensitiveEntities(
      chunk,
      job.policies as PolicyFragment[],
      job.analysisType as AnalysisTypeEnum,
      onStream,
    );
  }

  /**
   * Step 3: Validation
   */
  private async executeValidationStep(
    entities: SensitiveEntity[],
  ): Promise<SensitiveEntity[]> {
    if (!entities || entities.length === 0) {
      return [];
    }

    return await this.validator.validateEntities(entities);
  }

  /**
   * Step 4: Deduplication
   */
  private async executeDeduplicationStep(
    entities: SensitiveEntity[],
    analysisType: AnalysisTypeEnum,
  ): Promise<SensitiveEntity[]> {
    if (!entities || entities.length === 0) {
      return [];
    }

    return await this.deduper.removeDuplicates(
      entities as SensitiveEntity[],
      analysisType,
    );
  }
}
