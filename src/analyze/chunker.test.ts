import { AnalysisTypeEnum } from '../types';
import { ChunkerTool } from './chunker';

describe('ChunkerTool', () => {
  let chunker: ChunkerTool;

  beforeEach(() => {
    chunker = new ChunkerTool({
      chunkSize: 100,
      overlap: 20,
      columnChunkSize: 2,
    });
  });

  describe('createChunks', () => {
    it('should throw error for unsupported analysis type', async () => {
      await expect(
        chunker.createChunks('UNSUPPORTED' as AnalysisTypeEnum, 'test content'),
      ).rejects.toThrow('Unsupported analysis type: UNSUPPORTED');
    });

    it('should delegate to correct chunking strategy', async () => {
      const strategies = [
        { type: AnalysisTypeEnum.UNSTRUCTURED, content: 'test content' },
        { type: AnalysisTypeEnum.CSV, content: 'col1,col2\nval1,val2' },
        { type: AnalysisTypeEnum.JSON, content: '{"key": "value"}' },
        { type: AnalysisTypeEnum.SPREADSHEET, content: 'col1,col2\nval1,val2' },
      ];

      for (const strategy of strategies) {
        const chunks = await chunker.createChunks(
          strategy.type,
          strategy.content,
        );
        expect(chunks).toBeInstanceOf(Array);
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0]).toHaveProperty('id');
        expect(chunks[0]).toHaveProperty('text');
        expect(chunks[0]).toHaveProperty('offset');
        expect(chunks[0]).toHaveProperty('analysisType', strategy.type);
      }
    });
  });

  describe('unstructured text chunking', () => {
    it('should handle text shorter than chunk size', async () => {
      const shortText = 'Short text';
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.UNSTRUCTURED,
        shortText,
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(shortText);
      expect(chunks[0].offset).toBe(0);
    });

    it('should generate unique chunk IDs', async () => {
      const text = 'A'.repeat(250);
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.UNSTRUCTURED,
        text,
      );
      const ids = chunks.map((chunk) => chunk.id);
      const uniqueIds = Array.from(new Set(ids));
      expect(uniqueIds).toHaveLength(ids.length);
    });

    it('should clamp step when overlap >= chunkSize to avoid infinite loops', async () => {
      const risky = new ChunkerTool({ chunkSize: 100, overlap: 150 });
      const text = 'A'.repeat(500);
      const chunks = await risky.createChunks(
        AnalysisTypeEnum.UNSTRUCTURED,
        text,
      );
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((c) => c.offset >= 0)).toBe(true);
    });
  });

  describe('CSV chunking', () => {
    it('should chunk CSV by columns', async () => {
      const csvContent =
        'col1,col2,col3,col4\nval1,val2,val3,val4\nval5,val6,val7,val8';
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.CSV,
        csvContent,
      );

      expect(chunks).toHaveLength(2); // 4 columns / 2 per chunk
      expect(chunks[0].text).toContain('col1,col2');
      expect(chunks[0].text).toContain('val1,val2');
      expect(chunks[1].text).toContain('col3,col4');
      expect(chunks[1].text).toContain('val3,val4');
    });

    it('should handle CSV with fewer columns than chunk size', async () => {
      const csvContent = 'col1\nval1\nval2';
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.CSV,
        csvContent,
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(csvContent);
    });

    it('should handle empty CSV', async () => {
      const csvContent = '';
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.CSV,
        csvContent,
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('');
    });
  });

  describe('spreadsheet chunking', () => {
    it('should chunk spreadsheet data like CSV', async () => {
      const spreadsheetContent = 'Sheet1,Col1,Col2\nData1,Data2,Data3';
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.SPREADSHEET,
        spreadsheetContent,
      );

      expect(chunks).toHaveLength(2); // 3 columns / 2 per chunk
      expect(chunks[0].analysisType).toBe(AnalysisTypeEnum.SPREADSHEET);
    });
  });

  describe('JSON chunking', () => {
    it('should chunk valid JSON using MDocument', async () => {
      const jsonContent = JSON.stringify({
        users: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' },
        ],
        metadata: { count: 2, version: '1.0' },
      });

      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.JSON,
        jsonContent,
      );

      expect(chunks[0].analysisType).toBe(AnalysisTypeEnum.JSON);
      expect(chunks[0].text).toBeDefined();
    });

    it('should fallback to unstructured chunking for invalid JSON', async () => {
      const invalidJson = '{"invalid": json}'; // Missing quotes around "json"
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.JSON,
        invalidJson,
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].analysisType).toBe(AnalysisTypeEnum.JSON);
      expect(chunks[0].text).toBe(invalidJson);
    });

    it('should handle JSON that causes MDocument to fail', async () => {
      // Test with JSON that might cause MDocument.fromJSON to throw an error
      const problematicJson = JSON.stringify({
        data: null,
        empty: {},
        circular: 'reference',
      });
      const chunks = await chunker.createChunks(
        AnalysisTypeEnum.JSON,
        problematicJson,
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].analysisType).toBe(AnalysisTypeEnum.JSON);
    });
  });

  describe('configuration', () => {
    it('should use default options when none provided', () => {
      const defaultChunker = new ChunkerTool();
      const options = defaultChunker.getOptions();

      expect(options.chunkSize).toBe(2000);
      expect(options.overlap).toBe(200);
      expect(options.columnChunkSize).toBe(4);
    });

    it('should override default options with provided ones', () => {
      const customChunker = new ChunkerTool({
        chunkSize: 1000,
        overlap: 100,
      });
      const options = customChunker.getOptions();

      expect(options.chunkSize).toBe(1000);
      expect(options.overlap).toBe(100);
      expect(options.columnChunkSize).toBe(4); // Default value
    });

    it('should return immutable options', () => {
      const options = chunker.getOptions();
      const originalChunkSize = options.chunkSize;
      options.chunkSize = 999;

      const optionsAgain = chunker.getOptions();
      expect(optionsAgain.chunkSize).toBe(originalChunkSize);
    });
  });
});
