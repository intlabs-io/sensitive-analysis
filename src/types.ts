import { z } from 'zod';

export type PolicyFragment = {
  __typename: 'origin_policy';
  id: string;
  name: string;
  status: string;
  location?: any | null;
  documents?: Array<any> | null;
  type?: string | null;
  source?: string | null;
};

/**
 * Core data structures for sensitive analysis pipeline
 */

export enum AnalysisTypeEnum {
  UNSTRUCTURED = 'UNSTRUCTURED',
  SPREADSHEET = 'SPREADSHEET',
  JSON = 'JSON',
  CSV = 'CSV',
}

export interface ChunkData {
  id: string;
  text: string;
  offset: number;
  analysisType: AnalysisTypeEnum;
}

export interface SensitiveEntityBase {
  entity: string;
  reference: string;
  confidence: number;
  rankHex: string;
  category: string;
}

export interface UnstructuredSensitiveEntity extends SensitiveEntityBase {
  text: string;
}

export interface SpreadsheetSensitiveEntity extends SensitiveEntityBase {
  ranges: string[];
  sheetName: string;
}

export interface JsonSensitiveEntity extends SensitiveEntityBase {
  path: string;
}

export interface CsvSensitiveEntity extends SensitiveEntityBase {
  path: string;
}

export type SensitiveEntity =
  | UnstructuredSensitiveEntity
  | SpreadsheetSensitiveEntity
  | JsonSensitiveEntity
  | CsvSensitiveEntity;

export interface ProcessingJob {
  content: string;
  analysisType: AnalysisTypeEnum;
  policies: PolicyFragment[];
}

// Specific types for streaming entities during analysis
export interface StreamingEntityThinking {
  thinking?: string;
  entity?: string;
  reference?: string;
  confidence?: number;
  rankHex?: string;
  category?: string;
  path?: string;
  ranges?: string[];
  sheetName?: string;
  text?: string;
}

export interface StreamingEvent {
  type: 'thinking';
  data: {
    chunkId: string;
    entities: StreamingEntityThinking[];
    timestamp: number;
  };
}

// Analysis statistics interface
export interface AnalysisStats {
  chunksGenerated: number;
  entitiesFound: number;
  entitiesValidated: number;
  entitiesDeduplicated: number;
  processingTimeMs: number;
}

// Event data types for different events
export interface ThinkingEventData {
  chunkId: string;
  entities: StreamingEntityThinking[];
  timestamp: number;
}

export interface CompleteEventData {
  entities: SensitiveEntity[];
  stats: AnalysisStats;
}

export interface ErrorEventData {
  message: string;
}

export type AnalysisEventData =
  | ThinkingEventData
  | CompleteEventData
  | ErrorEventData;

// Vertex AI response types
export interface VertexAITextPart {
  text: string;
}

export interface VertexAIContent {
  parts: VertexAITextPart[];
}

export interface VertexAICandidate {
  content: VertexAIContent;
}

// JSON value types for proper JSON handling
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
  columnChunkSize?: number;
}

export interface ValidationConfig {
  minimumConfidence?: number;
  enableStrictMode?: boolean;
}

export interface DeduplicationConfig {
  caseSensitive?: boolean;
}

export interface WorkerPoolConfig {
  maxConcurrentWorkers: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface PolicyCacheEntry {
  id: string;
  content: string;
  lastAccessed: number;
}

/**
 * Zod schemas for AI SDK type-safe responses
 */
export const SensitiveEntityBaseSchema = z.object({
  entity: z.string(),
  reference: z.string(),
  confidence: z.number().min(0).max(10),
  rankHex: z.string().regex(/^#?[\dA-Fa-f]{6}$/, 'hex color like #AABBCC'),
  thinking: z.string(),
  category: z.string(),
});

export const UnstructuredSensitiveEntitySchema =
  SensitiveEntityBaseSchema.extend({
    text: z.string(),
  });

export const SpreadsheetSensitiveEntitySchema =
  SensitiveEntityBaseSchema.extend({
    ranges: z.array(z.string()),
    sheetName: z.string(),
  });

export const JsonSensitiveEntitySchema = SensitiveEntityBaseSchema.extend({
  path: z.string(),
});

export const CsvSensitiveEntitySchema = SensitiveEntityBaseSchema.extend({
  path: z.string(),
});

export const SensitiveEntitySchema = z.union([
  UnstructuredSensitiveEntitySchema,
  SpreadsheetSensitiveEntitySchema,
  JsonSensitiveEntitySchema,
  CsvSensitiveEntitySchema,
]);

export const SensitiveEntitiesArraySchema = z.array(SensitiveEntitySchema);

/**
 * Response format schemas for different analysis types
 * These are used with AI SDK's generateObject for type-safe responses
 * Note: AI SDK requires root schema to be an object, not an array
 */
export const CsvResponseSchema = z.object({
  entities: z.array(CsvSensitiveEntitySchema),
});

export const JsonResponseSchema = z.object({
  entities: z.array(JsonSensitiveEntitySchema),
});

export const UnstructuredResponseSchema = z.object({
  entities: z.array(UnstructuredSensitiveEntitySchema),
});

export const SpreadsheetResponseSchema = z.object({
  entities: z.array(SpreadsheetSensitiveEntitySchema),
});

/**
 * Type inference from Zod schemas
 */
export type CsvResponseType = z.infer<typeof CsvResponseSchema>;
export type JsonResponseType = z.infer<typeof JsonResponseSchema>;
export type UnstructuredResponseType = z.infer<
  typeof UnstructuredResponseSchema
>;
export type SpreadsheetResponseType = z.infer<typeof SpreadsheetResponseSchema>;
