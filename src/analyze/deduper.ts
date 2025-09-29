import type {
  CsvSensitiveEntity,
  DeduplicationConfig,
  JsonSensitiveEntity,
  SensitiveEntity,
  SpreadsheetSensitiveEntity,
  UnstructuredSensitiveEntity,
} from '../types';
import { AnalysisTypeEnum } from '../types';

/**
 * Type guard functions for each entity type
 */
function isUnstructuredSensitiveEntity(
  entity: SensitiveEntity,
): entity is UnstructuredSensitiveEntity {
  return 'text' in entity && typeof entity.text === 'string';
}

function isSpreadsheetSensitiveEntity(
  entity: SensitiveEntity,
): entity is SpreadsheetSensitiveEntity {
  return (
    'ranges' in entity &&
    Array.isArray(entity.ranges) &&
    'sheetName' in entity &&
    typeof entity.sheetName === 'string'
  );
}

function isStructuredSensitiveEntity(
  entity: SensitiveEntity,
): entity is JsonSensitiveEntity | CsvSensitiveEntity {
  return (
    'path' in entity && typeof entity.path === 'string' && !('ranges' in entity)
  );
}

/**
 * Deduper: Removes duplicate sensitive entities using various strategies
 */
export class DeduperTool {
  private config: DeduplicationConfig;

  constructor(config: DeduplicationConfig = {}) {
    const defaultConfig: DeduplicationConfig = {
      caseSensitive: false,
    };

    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Remove duplicates from an array of entities - overloaded for type safety
   */
  async removeDuplicates(
    entities: SensitiveEntity[],
    analysisType: AnalysisTypeEnum,
  ): Promise<SensitiveEntity[]> {
    switch (analysisType) {
      case AnalysisTypeEnum.UNSTRUCTURED: {
        /**
         * Deduplicate unstructured entities by text content
         */
        const unstructuredEntities = entities.filter(
          isUnstructuredSensitiveEntity,
        );
        if (
          unstructuredEntities.length !== entities.length &&
          process.env.NODE_ENV !== 'test'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `Expected ${entities.length} unstructured entities, but only ${unstructuredEntities.length} matched the type`,
          );
        }
        return this.deduplicateByKey(unstructuredEntities, (entity) =>
          this.config.caseSensitive ? entity.text : entity.text.toLowerCase(),
        );
      }
      case AnalysisTypeEnum.SPREADSHEET: {
        /**
         * Deduplicate spreadsheet entities by ranges and sheet name
         */
        const spreadsheetEntities = entities.filter(
          isSpreadsheetSensitiveEntity,
        );
        if (
          spreadsheetEntities.length !== entities.length &&
          process.env.NODE_ENV !== 'test'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `Expected ${entities.length} spreadsheet entities, but only ${spreadsheetEntities.length} matched the type`,
          );
        }
        const normalizeRanges = (ranges: string[]) =>
          [...ranges].sort((a, b) => a.localeCompare(b)).join(',');
        return this.deduplicateByKey(
          spreadsheetEntities,
          (entity) => `${entity.sheetName}:${normalizeRanges(entity.ranges)}`,
        );
      }
      case AnalysisTypeEnum.JSON: {
        /**
         * Deduplicate JSON entities by path
         */
        const jsonEntities = entities.filter(isStructuredSensitiveEntity);
        if (
          jsonEntities.length !== entities.length &&
          process.env.NODE_ENV !== 'test'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `Expected ${entities.length} JSON entities, but only ${jsonEntities.length} matched the type`,
          );
        }
        return this.deduplicateByKey(jsonEntities, (entity) => entity.path);
      }
      case AnalysisTypeEnum.CSV: {
        /**
         * Deduplicate CSV entities by path
         */
        const csvEntities = entities.filter(isStructuredSensitiveEntity);
        if (
          csvEntities.length !== entities.length &&
          process.env.NODE_ENV !== 'test'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `Expected ${entities.length} CSV entities, but only ${csvEntities.length} matched the type`,
          );
        }
        return this.deduplicateByKey(csvEntities, (entity) => entity.path);
      }
      default:
        return entities;
    }
  }

  /**
   * Generic deduplication method that keeps the highest confidence entity for each key
   */
  private deduplicateByKey<T extends SensitiveEntity>(
    entities: T[],
    keyExtractor: (entity: T) => string,
  ): T[] {
    const seen = new Map<string, T>();

    for (const entity of entities) {
      const key = keyExtractor(entity);
      const existing = seen.get(key);

      if (!existing || existing.confidence < entity.confidence) {
        seen.set(key, entity);
      }
    }

    return [...seen.values()];
  }

  /**
   * Get deduplication statistics
   */
  getStats(
    originalEntities: SensitiveEntity[],
    deduplicatedEntities: SensitiveEntity[],
  ): {
    original: number;
    deduplicated: number;
    removed: number;
    removalRate: number;
  } {
    const original = originalEntities.length;
    const deduplicated = deduplicatedEntities.length;
    const removed = original - deduplicated;

    return {
      original,
      deduplicated,
      removed,
      removalRate: original > 0 ? removed / original : 0,
    };
  }

  /**
   * Update deduplication configuration
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }
}

// Export default instance
export const deduperTool = new DeduperTool();
