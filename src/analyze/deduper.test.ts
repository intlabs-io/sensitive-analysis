import type {
  CsvSensitiveEntity,
  JsonSensitiveEntity,
  SensitiveEntity,
  SpreadsheetSensitiveEntity,
  UnstructuredSensitiveEntity,
} from '../types';
import { AnalysisTypeEnum } from '../types';
import { DeduperTool } from './deduper';

describe('DeduperTool', () => {
  let deduper: DeduperTool;

  // Constants for repeated strings
  const POLICY_REF = 'policy1';
  const EMAIL_ENTITY = 'email';
  const JOHN_EMAIL = 'john@example.com';
  const JANE_EMAIL = 'jane@example.com';
  const RANGE_A1A5 = 'A1:A5';
  const RANGE_B1B5 = 'B1:B5';
  const USER_EMAIL_PATH = 'user.email';
  const USER_PHONE_PATH = 'user.phone';
  const COLUMN_EMAIL_PATH = 'column:email';
  const COLUMN_PHONE_PATH = 'column:phone';

  beforeEach(() => {
    deduper = new DeduperTool({ caseSensitive: false });
  });

  describe('unstructured entity deduplication', () => {
    it('should deduplicate entities with identical text content', async () => {
      const entities: UnstructuredSensitiveEntity[] = [
        {
          entity: EMAIL_ENTITY,
          reference: POLICY_REF,
          confidence: 8,
          rankHex: '0x1',
          text: JOHN_EMAIL,
          category: 'personal',
        },
        {
          entity: EMAIL_ENTITY,
          reference: POLICY_REF,
          confidence: 9,
          rankHex: '0x2',
          text: JOHN_EMAIL,
          category: 'personal',
        },
        {
          entity: EMAIL_ENTITY,
          reference: POLICY_REF,
          confidence: 7,
          rankHex: '0x3',
          text: JANE_EMAIL,
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.UNSTRUCTURED,
      );

      expect(result).toHaveLength(2);
      expect(
        (
          result.find(
            (e) => (e as UnstructuredSensitiveEntity).text === JOHN_EMAIL,
          ) as UnstructuredSensitiveEntity
        )?.confidence,
      ).toBe(9);
      expect(
        (
          result.find(
            (e) => (e as UnstructuredSensitiveEntity).text === JANE_EMAIL,
          ) as UnstructuredSensitiveEntity
        )?.confidence,
      ).toBe(7);
    });

    it('should handle case sensitivity based on configuration', async () => {
      const caseSensitiveDeduper = new DeduperTool({ caseSensitive: true });
      const entities: UnstructuredSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'John@example.com',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          text: 'john@example.com',
          category: 'personal',
        },
      ];

      const caseInsensitiveResult = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.UNSTRUCTURED,
      );
      const caseSensitiveResult = await caseSensitiveDeduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.UNSTRUCTURED,
      );

      expect(caseInsensitiveResult).toHaveLength(1);
      expect(caseSensitiveResult).toHaveLength(2);
    });

    it('should handle empty entity list', async () => {
      const result = await deduper.removeDuplicates(
        [],
        AnalysisTypeEnum.UNSTRUCTURED,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('spreadsheet entity deduplication', () => {
    it('should deduplicate entities with identical ranges and sheet names', async () => {
      const entities: SpreadsheetSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          ranges: ['A1:A5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          ranges: ['A1:A5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 7,
          rankHex: '0x3',
          ranges: ['B1:B5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.SPREADSHEET,
      );

      expect(result).toHaveLength(2);
      expect(
        (
          result.find((e) =>
            (e as SpreadsheetSensitiveEntity).ranges.includes(RANGE_A1A5),
          ) as SpreadsheetSensitiveEntity
        )?.confidence,
      ).toBe(9);
      expect(
        (
          result.find((e) =>
            (e as SpreadsheetSensitiveEntity).ranges.includes(RANGE_B1B5),
          ) as SpreadsheetSensitiveEntity
        )?.confidence,
      ).toBe(7);
    });

    it('should handle multiple ranges in key generation', async () => {
      const entities: SpreadsheetSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          ranges: ['A1:A5', 'B1:B5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          ranges: ['A1:A5', 'B1:B5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.SPREADSHEET,
      );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(9);
    });

    it('should differentiate between different sheet names', async () => {
      const entities: SpreadsheetSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          ranges: ['A1:A5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          ranges: ['A1:A5'],
          sheetName: 'Sheet2',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.SPREADSHEET,
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('JSON entity deduplication', () => {
    it('should deduplicate entities with identical paths', async () => {
      const entities: JsonSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          path: 'user.email',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          path: 'user.email',
          category: 'personal',
        },
        {
          entity: 'phone',
          reference: 'policy1',
          confidence: 7,
          rankHex: '0x3',
          path: 'user.phone',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.JSON,
      );

      expect(result).toHaveLength(2);
      expect(
        (
          result.find(
            (e) => (e as JsonSensitiveEntity).path === USER_EMAIL_PATH,
          ) as JsonSensitiveEntity
        )?.confidence,
      ).toBe(9);
      expect(
        (
          result.find(
            (e) => (e as JsonSensitiveEntity).path === USER_PHONE_PATH,
          ) as JsonSensitiveEntity
        )?.confidence,
      ).toBe(7);
    });

    it('should handle complex nested paths', async () => {
      const entities: JsonSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          path: 'users[0].contact.email',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          path: 'users[0].contact.email',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.JSON,
      );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(9);
    });
  });

  describe('CSV entity deduplication', () => {
    it('should deduplicate entities with identical paths', async () => {
      const entities: CsvSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          path: 'column:email',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          path: 'column:email',
          category: 'personal',
        },
        {
          entity: 'phone',
          reference: 'policy1',
          confidence: 7,
          rankHex: '0x3',
          path: 'column:phone',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        AnalysisTypeEnum.CSV,
      );

      expect(result).toHaveLength(2);
      expect(
        (
          result.find(
            (e) => (e as CsvSensitiveEntity).path === COLUMN_EMAIL_PATH,
          ) as CsvSensitiveEntity
        )?.confidence,
      ).toBe(9);
      expect(
        (
          result.find(
            (e) => (e as CsvSensitiveEntity).path === COLUMN_PHONE_PATH,
          ) as CsvSensitiveEntity
        )?.confidence,
      ).toBe(7);
    });
  });

  describe('fail-safe guards', () => {
    it('should handle mixed entity types gracefully', async () => {
      const mixedEntities = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'john@example.com',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          ranges: ['A1:A5'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
      ];

      // Should handle type mismatch gracefully
      const result = await deduper.removeDuplicates(
        mixedEntities as SensitiveEntity[],
        AnalysisTypeEnum.UNSTRUCTURED,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('text');
    });

    it('should return original entities for unknown analysis type', async () => {
      const entities: UnstructuredSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'john@example.com',
          category: 'personal',
        },
      ];

      const result = await deduper.removeDuplicates(
        entities,
        'UNKNOWN' as AnalysisTypeEnum,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(entities[0]);
    });

    it('should handle entities with missing required properties', async () => {
      const incompleteEntities = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          // Missing text property for unstructured
        },
      ];

      const result = await deduper.removeDuplicates(
        incompleteEntities as SensitiveEntity[],
        AnalysisTypeEnum.UNSTRUCTURED,
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('statistics and configuration', () => {
    it('should provide accurate deduplication statistics', () => {
      const originalEntities = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'john@example.com',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          text: 'john@example.com',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 7,
          rankHex: '0x3',
          text: 'jane@example.com',
        },
      ];

      const deduplicatedEntities = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x2',
          text: 'john@example.com',
          category: 'personal',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 7,
          rankHex: '0x3',
          text: 'jane@example.com',
        },
      ];

      const stats = deduper.getStats(
        originalEntities as SensitiveEntity[],
        deduplicatedEntities as SensitiveEntity[],
      );

      expect(stats.original).toBe(3);
      expect(stats.deduplicated).toBe(2);
      expect(stats.removed).toBe(1);
      expect(stats.removalRate).toBeCloseTo(0.333, 2);
    });

    it('should handle empty arrays in statistics', () => {
      const stats = deduper.getStats([], []);

      expect(stats.original).toBe(0);
      expect(stats.deduplicated).toBe(0);
      expect(stats.removed).toBe(0);
      expect(stats.removalRate).toBe(0);
    });

    it('should update configuration correctly', () => {
      expect(deduper.getConfig().caseSensitive).toBe(false);

      deduper.updateConfig({ caseSensitive: true });

      expect(deduper.getConfig().caseSensitive).toBe(true);
    });

    it('should return immutable configuration', () => {
      const config = deduper.getConfig();
      config.caseSensitive = true;

      const configAgain = deduper.getConfig();
      expect(configAgain.caseSensitive).toBe(false);
    });
  });
});
