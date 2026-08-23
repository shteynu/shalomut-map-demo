import { NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { encodeAnalyticsInput } from '@/lib/analytics-encoder';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { validateRoundAnalyticsPayload } from '@/lib/round-analytics-payload';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';
import { reportRouteFailure } from '@/lib/server/request-error-report';

// The handler authenticates every call by reading the Authorization header, so
// it must stay dynamic. Under `force-static` — left over from the static export
// era — the deployed runtime hands the handler empty request headers, and the
// shared-secret check rejects even a correct secret.
export const dynamic = 'force-dynamic';

const roundAnalyticsOutputSchema = {
  type: 'object',
  properties: {
    contractVersion: { type: 'string' },
    roundId: { type: 'string' },
    organizationId: { type: 'string' },
    surveyDefinitionHash: { type: 'string' },
    totalResponses: { type: 'integer', minimum: 0 },
    privacyThreshold: { type: 'integer', minimum: 1 },
    isLocked: { type: 'boolean' },
    dimensionScores: { type: 'object' },
    questionAggregates: { type: 'object' },
    backgroundContext: { type: 'object' },
    calculatedAt: { type: 'string' },
  },
  required: [
    'contractVersion',
    'roundId',
    'totalResponses',
    'privacyThreshold',
    'isLocked',
    'dimensionScores',
    'questionAggregates',
    'calculatedAt',
  ],
  additionalProperties: false,
} as const;

/**
 * MCP Server HTTP JSON-RPC Endpoint (/api/mcp)
 * Enables external AI Microservices to query round analytics safely via Model Context Protocol.
 */
export async function POST(request: Request) {
  try {
    if (!hasConfiguredSharedSecret(request, 'MCP_SHARED_SECRET')) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32001, message: 'Unauthorized' },
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { jsonrpc, id, method, params } = body || {};

    if (jsonrpc !== '2.0') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      }, { status: 400 });
    }

    // MCP Tools Discovery
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_round_analytics',
              description: 'Fetch privacy-safe dimension and exact persisted question aggregates for a given survey round.',
              inputSchema: {
                type: 'object',
                properties: {
                  roundId: {
                    type: 'string',
                    description: 'The unique UUID of the survey round.',
                  },
                },
                required: ['roundId'],
              },
              outputSchema: roundAnalyticsOutputSchema,
            },
          ],
        },
      });
    }

    // MCP Tool Call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'get_round_analytics') {
        const roundId = args.roundId;
        if (!roundId) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: roundId is required' },
          }, { status: 400 });
        }

        const repositories = resolveCoreRepositories();

        const result = await AnalyticsService.getAnalyticsForRound(
          roundId,
          repositories.roundRepo,
          repositories.surveyRepo
        );
        if (!result) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Survey round not found: ${roundId}` },
          }, { status: 404 });
        }

        // Which fields this deployment's contract version carries is the
        // encoder's question, not the route's.
        const validation = validateRoundAnalyticsPayload(
          encodeAnalyticsInput(result),
        );
        if (!validation.ok) {
          throw new Error(`Core produced an invalid MCP payload: ${validation.error}`);
        }

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(validation.value),
              },
            ],
            structuredContent: validation.value,
          },
        });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool not found: ${toolName}` },
      }, { status: 404 });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    }, { status: 404 });
  } catch (error) {
    // The audit named this one as the worst of them: the caller here holds the
    // shared secret rather than a manager session, so the message went to
    // whatever is on the other end of that credential.
    reportRouteFailure(error, request);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error' },
    }, { status: 500 });
  }
}
