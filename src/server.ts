import express, { Request, Response } from 'express';
import cors from 'cors';

import { analyzeSensitiveContent } from './analyze/index';
import {
  AnalysisEventData,
  AnalysisTypeEnum,
  PolicyFragment,
} from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

interface StreamingRequestBody {
  content: string;
  analysisType: AnalysisTypeEnum;
  policies: PolicyFragment[];
}

/**
 * Streaming API endpoint for sensitive analysis
 * Returns Server-Sent Events (SSE) to show LLM thought process in real-time
 */
app.post('/api/analyze', async (request: Request, response: Response) => {
  try {
    const body = request.body as StreamingRequestBody;

    // Validation
    if (!body.content?.trim()) {
      return response.status(400).json({ error: 'Content is required for analysis' });
    }

    if (
      !Array.isArray(body.policies) ||
      body.policies.length === 0 ||
      !body.policies.every(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          p.id &&
          typeof p.name === 'string' &&
          p.name,
      )
    ) {
      return response.status(400).json({ error: 'At least one valid policy must be selected' });
    }

    const validTypes = new Set<AnalysisTypeEnum>([
      AnalysisTypeEnum.UNSTRUCTURED,
      AnalysisTypeEnum.CSV,
      AnalysisTypeEnum.JSON,
      AnalysisTypeEnum.SPREADSHEET,
    ]);
    if (!body.analysisType || !validTypes.has(body.analysisType)) {
      return response.status(400).json({ error: 'Valid analysis type is required' });
    }

    // Set up Server-Sent Events headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // Handle client disconnect
    const cleanup = () => {
      response.end();
    };
    request.on('close', cleanup);
    request.on('aborted', cleanup);

    // Helper function to send SSE data with type included in data
    const sendEvent = (
      type: 'thinking' | 'complete' | 'error',
      data: AnalysisEventData,
    ) => {
      const eventData = { type, ...data };
      const sseData = `data: ${JSON.stringify(eventData)}\n\n`;
      response.write(sseData);
    };

    try {
      // Start the streaming analysis with direct event callback
      await analyzeSensitiveContent(
        {
          content: body.content,
          analysisType: body.analysisType,
          policies: body.policies,
        },
        (
          type: 'thinking' | 'complete' | 'error',
          data: AnalysisEventData,
        ) => {
          // Send event directly to SSE stream
          sendEvent(type, data);

          // Close stream on completion or error
          if (type === 'complete' || type === 'error') {
            response.end();
          }
        },
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Streaming analysis error:', error);
      sendEvent('error', {
        message:
          error instanceof Error
            ? error.message
            : 'An error occurred during analysis',
      });
      response.end();
    }

    // Stream is handled above, no return needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('API route error:', error);
    return response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'An error occurred during analysis',
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Sensitive Analysis Server running on port ${PORT}`);
  console.log(`📊 Analysis endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

export default app;
