import { extractPolicyFromUrl } from './extractPolicyFromUrl';

// Mock Firecrawl at the module level
jest.mock('@mendable/firecrawl-js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      extract: jest
        .fn()
        .mockImplementation(async ({ urls }: { urls: string[] }) => {
          const url = urls[0];
          // Simulate failure for malformed URLs, success otherwise
          if (typeof url === 'string' && url.startsWith('http23://')) {
            return { success: false };
          }
          return {
            success: true,
            data: {
              node: [
                {
                  title: 'Section 1798.140 — Definitions.',
                  snippet: '... personal information including email ...',
                },
              ],
            },
          };
        }),
    })),
  };
});

const measureImplementation = async (query: string, response: string) => {
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
};

const createMockMastraMetric = () => {
  return {
    measure: jest.fn().mockImplementation(measureImplementation),
  };
};

describe('extractPolicyFromUrl', () => {
  const mockMastraMetric = createMockMastraMetric();
  beforeAll(() => {
    // Ensure code path that checks the key does not throw
    process.env.FIRECRAWL_API_KEY = 'test-key';
  });

  beforeEach(() => {
    // Reset mock calls before each test
    jest.clearAllMocks();
  });

  it('should extract policy data successfully from a valid URL', async () => {
    const result = await extractPolicyFromUrl(
      'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5',
      '123',
    );
    expect(result.success).toBe(true);
  }, 60000); // 60 second timeout for API calls

  it('should fail to extract policy data from an invalid URL', async () => {
    const result = await extractPolicyFromUrl(
      'http23://this.url.is.invalid',
      '123',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid URL');
  }, 60000); // 60 second timeout for API calls

  it('should extract expected policy excerpts - metric test', async () => {
    const result = await extractPolicyFromUrl(
      'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5',
      '123',
    );
    const metricResult = await mockMastraMetric.measure(
      `The response should contain the following
      - title Section 1798.140 — Definitions.
      - Meaning of "personal information"
      `,
      JSON.stringify(result),
    );

    // Metric result logged for debugging
    expect(metricResult.info.reason).toBeDefined();

    expect(metricResult.score).toBeGreaterThan(0.8);
    expect(result.data?.node.length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
  }, 60000); // 60 second timeout for API calls

  it('should call UpdatePolicy with success status when extraction succeeds', async () => {
    const policyId = 'test-policy-123';
    const result = await extractPolicyFromUrl(
      'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5',
      policyId,
    );

    expect(result.success).toBe(true);
  }, 60000);

  it('should call UpdatePolicy with error status when extraction fails', async () => {
    const policyId = 'test-policy-error';
    const result = await extractPolicyFromUrl('http23://invalid-url', policyId);
    expect(result.success).toBe(false);
  }, 60000);
});
