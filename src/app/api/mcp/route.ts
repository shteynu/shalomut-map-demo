import { NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { getRepositories } from '@/lib/repositories';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

// The handler authenticates every call by reading the Authorization header, so
// it must stay dynamic. Under `force-static` — left over from the static export
// era — the deployed runtime hands the handler empty request headers, and the
// shared-secret check rejects even a correct secret.
export const dynamic = 'force-dynamic';

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
              description: 'Fetch aggregated wellbeing dimension scores and privacy lock status for a given survey round.',
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

        const repositories = getRepositories();

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

        // Format into strict RoundAnalyticsResult MCP payload
        const mcpPayload = {
          roundId: result.roundId,
          totalResponses: result.totalResponses,
          privacyThreshold: result.privacyThreshold,
          isLocked: result.isLocked,
          dimensionScores: result.dimensionScores,
          organizationContext: {
            schoolType: 'Comprehensive School',
            district: 'Central',
          },
        };

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(mcpPayload),
              },
            ],
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
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: `Internal error: ${error.message}` },
    }, { status: 500 });
  }
}
