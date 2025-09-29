import type {
  ChunkData,
  ChunkingOptions,
  JsonObject,
  JsonValue,
} from '../types';
import { AnalysisTypeEnum } from '../types';

// CSV-aware parser for entire content (handles quoted commas and embedded newlines)
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  let index = 0;
  while (index < content.length) {
    const ch = content[index];

    if (ch === '"') {
      // Escaped quote inside a quoted field
      if (inQuotes && content[index + 1] === '"') {
        currentField += '"';
        index += 2;
        continue;
      }
      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (!inQuotes && ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      index += 1;
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      // Handle Windows CRLF by skipping the next \n if present
      if (ch === '\r' && content[index + 1] === '\n') {
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    currentField += ch;
    index += 1;
  }

  // Push the last field/row (ensures empty content yields one empty field row)
  currentRow.push(currentField);
  rows.push(currentRow);

  return rows;
}

/**
 * Serialize an array of values into a proper CSV row string.
 * Escapes quotes by doubling them and wraps fields containing
 * commas, quotes, or newlines in quotes.
 */
function serializeCsvRow(vals: string[]): string {
  return vals
    .map((val) => {
      // Escape quotes by doubling them
      const escaped = val.replace(/"/g, '""');

      // If the field contains comma, quote, or newline, wrap in quotes
      if (
        escaped.includes(',') ||
        escaped.includes('"') ||
        escaped.includes('\r') ||
        escaped.includes('\n')
      ) {
        return `"${escaped}"`;
      }

      return escaped;
    })
    .join(',');
}

/**
 * Chunker: Produces overlapping chunks to ensure entities
 * that straddle boundaries are not missed
 */
export class ChunkerTool {
  private options: Required<ChunkingOptions>;

  constructor(options: ChunkingOptions = {}) {
    const defaultOptions: Required<ChunkingOptions> = {
      chunkSize: 2000,
      overlap: 200,
      columnChunkSize: 4,
    };

    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Main entry point for creating chunks based on analysis type
   */
  async createChunks(
    analysisType: AnalysisTypeEnum,
    content: string,
  ): Promise<ChunkData[]> {
    const strategy = this.getChunkingStrategy(analysisType);
    return strategy(content, analysisType);
  }

  /**
   * Get the appropriate chunking strategy for the analysis type
   */
  private getChunkingStrategy(analysisType: AnalysisTypeEnum) {
    const strategies = {
      UNSTRUCTURED: this.chunkUnstructured.bind(this),
      CSV: this.chunkByColumn.bind(this),
      JSON: this.chunkJson.bind(this),
      SPREADSHEET: this.chunkByColumn.bind(this),
    };

    const strategy = strategies[analysisType];
    if (!strategy) {
      throw new Error(`Unsupported analysis type: ${analysisType}`);
    }

    return strategy;
  }

  /**
   * Chunk unstructured text with overlapping windows
   */
  private chunkUnstructured(
    text: string,
    analysisType: AnalysisTypeEnum,
  ): ChunkData[] {
    const { chunkSize, overlap } = this.options;
    // normalize and clamp to safe values
    const size = Math.max(1, Math.floor(chunkSize));
    const ov = Math.max(0, Math.floor(overlap));
    const step = Math.max(1, size - ov);
    const chunks: ChunkData[] = [];
    let start = 0;

    // Ensure at least one chunk is created, even for empty content
    if (text.length === 0) {
      chunks.push({
        id: this.generateChunkId(0),
        text: '',
        offset: 0,
        analysisType,
      });
      return chunks;
    }

    while (start < text.length) {
      const end = Math.min(text.length, start + size);
      const chunkText = text.slice(start, end);

      chunks.push({
        id: this.generateChunkId(chunks.length),
        text: chunkText,
        offset: start,
        analysisType,
      });

      // Move start position with overlap consideration (guaranteed > 0)
      start += step;

      // Break if we've covered the entire text
      if (end >= text.length) break;
    }

    return chunks;
  }

  /**
   * Chunk CSV/Spreadsheet data by columns to maintain structure.
   *
   * Note: The returned chunk.offset represents the starting column index
   * within the original CSV (0-based), not a character offset.
   */
  private chunkByColumn(
    csv: string,
    analysisType: AnalysisTypeEnum,
  ): ChunkData[] {
    const parsedRows = parseCsv(csv);
    const header = parsedRows[0] ?? [];
    const { columnChunkSize } = this.options;
    const chunks: ChunkData[] = [];

    // Fallback for missing/blank header
    if (header.length === 0 || header.every((h) => h.trim() === '')) {
      return this.chunkUnstructured(csv, analysisType);
    }

    for (let i = 0; i < header.length; i += columnChunkSize) {
      const columns = header.slice(i, i + columnChunkSize);
      const rows = parsedRows.slice(1).map((row) => {
        const cols = row;
        return serializeCsvRow(cols.slice(i, i + columnChunkSize));
      });

      const chunkText = [serializeCsvRow(columns), ...rows].join('\n');

      chunks.push({
        id: this.generateChunkId(chunks.length),
        text: chunkText,
        offset: i, // Column offset instead of character offset
        analysisType,
      });
    }

    return chunks;
  }

  /**
   * Chunk JSON data using custom JSON-aware chunking
   */
  private chunkJson(
    jsonStr: string,
    analysisType: AnalysisTypeEnum,
  ): ChunkData[] {
    try {
      // First validate that the input is valid JSON
      const parsedJson = JSON.parse(jsonStr);

      // Use recursive chunking for structured JSON
      return this.recursiveJsonChunk(parsedJson, '', analysisType);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn(
          'Failed to parse JSON, falling back to unstructured chunking:',
          error,
        );
      }
      // Fallback to unstructured chunking if JSON parsing fails
      return this.chunkUnstructured(jsonStr, analysisType);
    }
  }

  /**
   * Recursively chunk JSON objects and arrays
   */
  private recursiveJsonChunk(
    obj: JsonValue,
    currentPath: string,
    analysisType: AnalysisTypeEnum,
    chunks: ChunkData[] = [],
  ): ChunkData[] {
    if (obj === null || obj === undefined) {
      return chunks;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      obj.map((item, index) => {
        const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
        this.recursiveJsonChunk(item, newPath, analysisType, chunks);
      });
      return chunks;
    }

    // Handle objects
    if (typeof obj === 'object') {
      // Create a chunk for the current object level if it has enough content
      const objRecord = obj as JsonObject;
      const objStr = JSON.stringify(objRecord, null, 2);
      if (objStr.length <= this.options.chunkSize) {
        // Small object - create single chunk
        chunks.push({
          id: this.generateChunkId(chunks.length),
          text: objStr,
          offset: chunks.length * this.options.chunkSize,
          analysisType,
        });
      } else {
        // Large object - chunk by properties
        Object.entries(objRecord).map(([key, value]) => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          this.recursiveJsonChunk(value, newPath, analysisType, chunks);
        });
      }
      return chunks;
    }

    // Handle primitive values
    const primitiveStr = currentPath
      ? `"${currentPath}": ${JSON.stringify(obj)}`
      : JSON.stringify(obj);

    chunks.push({
      id: this.generateChunkId(chunks.length),
      text: primitiveStr,
      offset: chunks.length * this.options.chunkSize,
      analysisType,
    });

    return chunks;
  }

  /**
   * Generate a unique chunk ID
   */
  private generateChunkId(index: number): string {
    return `chunk_${Date.now()}_${index}`;
  }

  /**
   * Get current chunking configuration
   */
  getOptions(): Required<ChunkingOptions> {
    return { ...this.options };
  }
}

// Export default instance
export const chunkerTool = new ChunkerTool();
