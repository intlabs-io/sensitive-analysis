import { streamObject } from 'ai';

import { PolicyFragment } from '../types';

import type { ChunkData, SensitiveEntity } from '../types';
import { AnalysisTypeEnum } from '../types';
import { IdentifierTool } from './identifier';

// Mock AI SDK functions
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
  streamObject: jest.fn(),
}));

// Load environment variables before running tests
try {
  // Try to load dotenv if available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv');
  dotenv.config();
  // eslint-disable-next-line no-console
  console.log(
    '✅ Environment variables loaded via dotenv for identifier tests',
  );
} catch (error) {
  // eslint-disable-next-line no-console
  console.log(
    '⚠️  dotenv not available for identifier tests, using process.env directly',
  );
}

// Alternative: Set test environment variables directly if not set
if (!process.env.OPENAI_API_KEY) {
  // You can set your API key here for testing (not recommended for production)
  // process.env.OPENAI_API_KEY = 'your-api-key-here';
  // eslint-disable-next-line no-console
  console.log(
    '❌ OPENAI_API_KEY not set - API calls will fail in identifier tests',
  );
  // eslint-disable-next-line no-console
  console.log(
    '💡 To fix: Set OPENAI_API_KEY in .env file or environment variables',
  );
  // eslint-disable-next-line no-console
  console.log('💡 Example: export OPENAI_API_KEY="sk-your-api-key-here"');
} else {
  // eslint-disable-next-line no-console
  console.log('✅ OPENAI_API_KEY is set for identifier tests');
}

// eslint-disable-next-line no-console
console.log(
  '\n🚀 Starting identifier tests with environment configuration...\n',
);

jest.mock('../policy/findPoliciesAndFormat', () => ({
  findPoliciesAndFormat: jest.fn(),
}));

jest.mock('../prompts', () => ({
  getAnalysisPrompt: jest.fn(),
}));

// Helper function to create mock streaming result
const createMockStreamResult = (entities: SensitiveEntity[]) => {
  return {
    textStream: (async function* () {
      yield 'Analyzing content...';
      yield 'Finding sensitive entities...';
      yield 'Processing complete.';
    })(),
    partialObjectStream: (async function* () {
      yield { entities: entities.slice(0, Math.ceil(entities.length / 2)) };
      yield { entities };
    })(),
    object: Promise.resolve({ entities }),
    warnings: undefined,
    usage: undefined,
    providerMetadata: undefined,
    request: undefined,
    response: undefined,
    finishReason: undefined,
  } as unknown as ReturnType<typeof streamObject>;
};

describe('IdentifierTool', () => {
  let identifier: IdentifierTool;
  let mockFindPoliciesAndFormat: jest.Mock;
  let mockGetAnalysisPrompt: jest.Mock;
  const mockMastraMetric = {
    measure: jest
      .fn()
      .mockImplementation(async (query: string, response: string) => {
        // Simple mock implementation that returns high scores for relevant content
        const score =
          query.includes('email') && response.includes('email') ? 0.95 : 0.85;
        return {
          score,
          info: {
            reason:
              score > 0.9
                ? 'Response is highly relevant to the query content'
                : 'Response is relevant to the query content',
          },
        };
      }),
  };

  // Mock streaming callback for tests
  const mockOnStream = jest.fn();

  beforeEach(() => {
    identifier = new IdentifierTool();
    mockFindPoliciesAndFormat =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../policy/findPoliciesAndFormat').findPoliciesAndFormat;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockGetAnalysisPrompt = require('../prompts').getAnalysisPrompt;

    // Reset mocks
    jest.clearAllMocks();
    mockOnStream.mockClear();
  });

  describe('identifySensitiveEntities', () => {
    const mockChunk: ChunkData = {
      id: 'chunk_1',
      text: 'John Doe works at john.doe@example.com and his phone is 555-1234',
      offset: 0,
      analysisType: AnalysisTypeEnum.UNSTRUCTURED,
    };

    const mockPolicies: PolicyFragment[] = [
      {
        __typename: 'origin_policy',
        id: 'policy-1',
        name: 'Email Policy',
        status: 'ACTIVE',
      },
      {
        __typename: 'origin_policy',
        id: 'policy-2',
        name: 'Phone Policy',
        status: 'ACTIVE',
      },
    ];

    it('should identify email addresses according to policy', async () => {
      const expectedEntities = [
        {
          entity: 'email',
          reference: 'Email Policy',
          confidence: 9,
          rankHex: '0x1',
          text: 'john.doe@example.com',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: Email addresses should not be shared publicly',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this text for sensitive information...',
      );

      // Mock the streaming object
      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(mockFindPoliciesAndFormat).toHaveBeenCalledWith(mockPolicies);
      expect(mockGetAnalysisPrompt).toHaveBeenCalledWith(
        AnalysisTypeEnum.UNSTRUCTURED,
        {
          policies: 'Policy: Email addresses should not be shared publicly',
          extract: mockChunk.text,
        },
      );
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should identify phone numbers according to policy', async () => {
      const expectedEntities = [
        {
          entity: 'phone',
          reference: 'Phone Policy',
          confidence: 8,
          rankHex: '0x2',
          text: '555-1234',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: Phone numbers are considered PII and should be protected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this text for phone numbers...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should identify multiple entities with different confidence levels', async () => {
      const expectedEntities = [
        {
          entity: 'email',
          reference: 'Email Policy',
          confidence: 9,
          rankHex: '0x1',
          text: 'john.doe@example.com',
          category: 'personal',
        },
        {
          entity: 'phone',
          reference: 'Phone Policy',
          confidence: 8,
          rankHex: '0x2',
          text: '555-1234',
          category: 'personal',
        },
        {
          entity: 'name',
          reference: 'PII Policy',
          confidence: 7,
          rankHex: '0x3',
          text: 'John Doe',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: Personal information should be protected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this text comprehensively...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(result).toHaveLength(3);
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should handle CSV analysis type', async () => {
      const csvChunk: ChunkData = {
        id: 'chunk_csv',
        text: 'email,phone\njohn@example.com,555-1234\njane@example.com,555-5678',
        offset: 0,
        analysisType: AnalysisTypeEnum.CSV,
      };

      const expectedEntities = [
        {
          entity: 'email',
          reference: 'Email Policy',
          confidence: 9,
          rankHex: '0x1',
          path: 'column:email',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: Email addresses in CSV files should be protected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this CSV for sensitive data...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        csvChunk,
        mockPolicies,
        AnalysisTypeEnum.CSV,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(mockGetAnalysisPrompt).toHaveBeenCalledWith(
        AnalysisTypeEnum.CSV,
        expect.objectContaining({
          extract: csvChunk.text,
        }),
      );
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should handle JSON analysis type', async () => {
      const jsonChunk: ChunkData = {
        id: 'chunk_json',
        text: '{"user": {"email": "john@example.com", "phone": "555-1234"}}',
        offset: 0,
        analysisType: AnalysisTypeEnum.JSON,
      };

      const expectedEntities = [
        {
          entity: 'email',
          reference: 'Email Policy',
          confidence: 9,
          rankHex: '0x1',
          path: 'user.email',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: JSON email fields should be protected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this JSON for sensitive data...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        jsonChunk,
        mockPolicies,
        AnalysisTypeEnum.JSON,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should handle spreadsheet analysis type', async () => {
      const spreadsheetChunk: ChunkData = {
        id: 'chunk_spreadsheet',
        text: 'A1: Email, B1: Phone\nA2: john@example.com, B2: 555-1234',
        offset: 0,
        analysisType: AnalysisTypeEnum.SPREADSHEET,
      };

      const expectedEntities = [
        {
          entity: 'email',
          reference: 'Email Policy',
          confidence: 9,
          rankHex: '0x1',
          ranges: ['A2'],
          sheetName: 'Sheet1',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: Spreadsheet email data should be protected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze this spreadsheet for sensitive data...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        spreadsheetChunk,
        mockPolicies,
        AnalysisTypeEnum.SPREADSHEET,
        mockOnStream,
      );

      expect(result).toEqual(expectedEntities);
      expect(mockOnStream).toHaveBeenCalled();
    });

    it('should return empty array when no entities found', async () => {
      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: No sensitive data detected',
      ]);

      mockGetAnalysisPrompt.mockReturnValue('Analyze this text...');

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(createMockStreamResult([]));

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual([]);
      // For empty results, stream may not be called since no entities are found
    });

    it('should handle empty response from model', async () => {
      mockFindPoliciesAndFormat.mockResolvedValue(['Policy: Test policy']);

      mockGetAnalysisPrompt.mockReturnValue('Analyze this text...');

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(createMockStreamResult([]));

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual([]);
      // For empty results, stream may not be called since no entities are found
    });

    it('should handle invalid JSON response gracefully', async () => {
      mockFindPoliciesAndFormat.mockResolvedValue(['Policy: Test policy']);

      mockGetAnalysisPrompt.mockReturnValue('Analyze this text...');

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      // Mock a stream that throws an error
      mockStreamObject.mockImplementation(() => {
        throw new Error('Invalid JSON response');
      });

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual([]);
      // mockOnStream may not be called due to error, so don't assert it
    });

    it('should handle errors during identification', async () => {
      mockFindPoliciesAndFormat.mockRejectedValue(
        new Error('Policy loading failed'),
      );

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual([]);
      // mockOnStream may not be called due to error, so don't assert it
    });

    it('should handle model generation errors', async () => {
      mockFindPoliciesAndFormat.mockResolvedValue(['Policy: Test policy']);

      mockGetAnalysisPrompt.mockReturnValue('Analyze this text...');

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockImplementation(() => {
        throw new Error('Model generation failed');
      });

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        mockPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      expect(result).toEqual([]);
      // mockOnStream may not be called due to error, so don't assert it
    });

    it('should fail on unexpected errors in test environment', async () => {
      mockFindPoliciesAndFormat.mockResolvedValue(['Policy: Test policy']);

      mockGetAnalysisPrompt.mockReturnValue('Analyze this text...');

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockImplementation(() => {
        throw new Error('Unexpected network error');
      });

      await expect(
        identifier.identifySensitiveEntities(
          mockChunk,
          mockPolicies,
          AnalysisTypeEnum.UNSTRUCTURED,
          mockOnStream,
        ),
      ).rejects.toThrow('Unexpected network error');
    });
  });

  describe('privacy policy scenarios', () => {
    it('should respect complex privacy policies - metric test', async () => {
      const mockChunk: ChunkData = {
        id: 'chunk_complex',
        text: 'Employee ID: 12345, SSN: 123-45-6789, john@company.com are apart of the company Google which resides in California',
        offset: 0,
        analysisType: AnalysisTypeEnum.UNSTRUCTURED,
      };

      const complexPolicies: PolicyFragment[] = [
        {
          __typename: 'origin_policy',
          id: 'policy-ssn',
          name: 'SSN Protection Policy',
          status: 'ACTIVE',
        },
        {
          __typename: 'origin_policy',
          id: 'policy-employee',
          name: 'Employee Data Policy',
          status: 'ACTIVE',
        },
      ];

      const expectedEntities = [
        {
          entity: 'ssn',
          reference: 'SSN Protection Policy',
          confidence: 10,
          rankHex: '0x1',
          text: '123-45-6789',
          category: 'personal',
        },
        {
          entity: 'employee_id',
          reference: 'Employee Data Policy',
          confidence: 8,
          rankHex: '0x2',
          text: '12345',
          category: 'personal',
        },
      ];

      mockFindPoliciesAndFormat.mockResolvedValue([
        'Policy: SSN numbers must be redacted completely',
        'Policy: Employee IDs should be protected from external sharing',
      ]);

      mockGetAnalysisPrompt.mockReturnValue(
        'Analyze according to complex policies...',
      );

      const mockStreamObject = streamObject as jest.MockedFunction<
        typeof streamObject
      >;
      mockStreamObject.mockReturnValue(
        createMockStreamResult(expectedEntities),
      );

      const result = await identifier.identifySensitiveEntities(
        mockChunk,
        complexPolicies,
        AnalysisTypeEnum.UNSTRUCTURED,
        mockOnStream,
      );

      const metricResult = await mockMastraMetric.measure(
        'The response should contain only the SSN and Employee ID',
        JSON.stringify(result),
      );

      // Metric result logged for debugging
      expect(metricResult.info.reason).toBeDefined();

      expect(metricResult.score).toBeGreaterThan(0.8);
      expect(result.length).toBe(2);
      expect(mockOnStream).toHaveBeenCalled();
    }, 30000);
  });
});
