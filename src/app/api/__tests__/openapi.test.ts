import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as {
  load(source: string): Record<string, any>;
};

describe('OpenAPI Specification Integrity', () => {
  const openapiPath = path.join(process.cwd(), 'public', 'openapi.json');

  it('should verify public/openapi.json file exists and is valid JSON', () => {
    assert.strictEqual(fs.existsSync(openapiPath), true, 'public/openapi.json must exist');
    const fileContent = fs.readFileSync(openapiPath, 'utf8');
    const spec = JSON.parse(fileContent);

    assert.ok(spec.openapi.startsWith('3.0'), 'Spec must be OpenAPI 3.0.x');
    assert.strictEqual(spec.info.title.includes('Shalomut Map API'), true);
  });

  it('should contain all required REST API routes', () => {
    const fileContent = fs.readFileSync(openapiPath, 'utf8');
    const spec = JSON.parse(fileContent);
    const paths = Object.keys(spec.paths);

    assert.ok(paths.includes('/api/health'), 'Must include the health/capability path');
    assert.ok(paths.includes('/api/rounds'), 'Must include /api/rounds path');
    assert.ok(paths.includes('/api/manager/setup'), 'Must include manager setup persistence path');
    assert.ok(paths.includes('/api/rounds/{roundId}'), 'Must include survey round update path');
    assert.ok(paths.includes('/api/rounds/{roundId}/survey-definition'), 'Must include survey definition persistence path');
    assert.ok(paths.includes('/api/survey/{shareCode}'), 'Must include /api/survey/{shareCode} path');
    assert.ok(paths.includes('/api/survey/{shareCode}/submit'), 'Must include /api/survey/{shareCode}/submit path');
    assert.ok(paths.includes('/api/rounds/{roundId}/analytics'), 'Must include /api/rounds/{roundId}/analytics path');
    assert.ok(paths.includes('/api/mcp'), 'Must include /api/mcp path');
    assert.ok(paths.includes('/api/rounds/{roundId}/ai-insights'), 'Must include AI insights callback/read path');
    assert.ok(paths.includes('/api/rounds/{roundId}/trigger-ai'), 'Must include AI analytics trigger path');
    assert.ok(paths.includes('/api/rounds/{roundId}/reset'), 'Must include reset round path');
    assert.ok(
      paths.includes('/api/manager/question-suggestion'),
      'Must include the question suggestion path',
    );
  });

  it('documents that a suggestion may only be labelled as the model\'s', () => {
    // The label is the product rule of this route, so the published shape has to
    // carry it: a consumer must not be told that `template` can arrive here. The
    // builder's other source is the canonical questionnaire, labelled locally.
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    const suggestion =
      spec.paths['/api/manager/question-suggestion'].post.responses['200']
        .content['application/json'].schema;

    assert.strictEqual(suggestion.$ref, '#/components/schemas/QuestionSuggestion');
    assert.deepStrictEqual(
      spec.components.schemas.QuestionSuggestion.properties.source.enum,
      ['ai'],
    );
    assert.deepStrictEqual(
      spec.components.schemas.QuestionSuggestionRequest.required,
      ['dimensionId'],
    );
    assert.strictEqual(
      spec.components.schemas.QuestionSuggestionRequest.properties.dimensionId
        .$ref,
      '#/components/schemas/WellbeingDimensionId',
    );
  });

  it('should define essential data schemas matching backend types', () => {
    const fileContent = fs.readFileSync(openapiPath, 'utf8');
    const spec = JSON.parse(fileContent);
    const schemas = spec.components.schemas;

    assert.ok(schemas.SurveyRound, 'Must include SurveyRound schema');
    assert.ok(schemas.CreateRoundInput, 'Must include CreateRoundInput schema');
    assert.ok(schemas.ManagerSetupInput, 'Must include ManagerSetupInput schema');
    assert.ok(schemas.SurveyDefinition, 'Must include SurveyDefinition schema');
    assert.ok(schemas.QuestionAnswerInput, 'Must include QuestionAnswerInput schema');
    assert.ok(schemas.RoundAnalyticsResult, 'Must include RoundAnalyticsResult schema');
    assert.ok(schemas.RoundAnalyticsResultV2, 'Must preserve RoundAnalyticsResultV2 schema');
    assert.ok(schemas.RoundAnalyticsResultV3, 'Must include dynamic RoundAnalyticsResultV3 schema');
    assert.ok(schemas.RoundDimensionScore, 'Must include RoundDimensionScore schema');
    assert.ok(schemas.QuestionAggregate, 'Must include QuestionAggregate schema');
    assert.ok(schemas.DynamicQuestionAggregate, 'Must include DynamicQuestionAggregate schema');
    assert.ok(schemas.WellbeingDimensionId, 'Must include WellbeingDimensionId schema');
    assert.ok(schemas.StoneMapResult, 'Must include StoneMapResult schema');
    assert.ok(schemas.StoneMapResultV1, 'Must preserve StoneMapResultV1 schema');
    assert.ok(schemas.StoneMapResultV2, 'Must include StoneMapResultV2 schema');
    assert.ok(schemas.StoneMapResultV3, 'Must include StoneMapResultV3 schema');
    assert.ok(schemas.StoneMapResultV4, 'Must include StoneMapResultV4 schema');
    assert.ok(schemas.StoneMapResultV5, 'Must include StoneMapResultV5 schema');
    assert.ok(schemas.StoneDetail, 'Must include StoneDetail schema');
    assert.ok(schemas.StoneDetailV4, 'Must include StoneDetailV4 schema');
    assert.ok(schemas.StoneDetailV5, 'Must include StoneDetailV5 schema');
    assert.strictEqual(schemas.StoneMapResultV1.properties.contractVersion.example, '1.0');
    assert.strictEqual(schemas.StoneMapResultV2.properties.contractVersion.example, '2.0');
    assert.strictEqual(schemas.StoneMapResultV3.properties.contractVersion.example, '3.0');
    assert.strictEqual(schemas.StoneMapResultV4.properties.contractVersion.example, '4.0');
    assert.strictEqual(schemas.StoneMapResultV5.properties.contractVersion.example, '5.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV2.properties.contractVersion.example, '2.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV3.properties.contractVersion.example, '3.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV4.properties.contractVersion.example, '4.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV5.properties.contractVersion.example, '5.0');
    assert.deepStrictEqual(
      schemas.RoundAnalyticsResult.oneOf.map((entry: { $ref: string }) => entry.$ref),
      [
        '#/components/schemas/RoundAnalyticsResultV2',
        '#/components/schemas/RoundAnalyticsResultV3',
        '#/components/schemas/RoundAnalyticsResultV4',
        '#/components/schemas/RoundAnalyticsResultV5',
      ],
    );
    assert.deepStrictEqual(
      schemas.StoneMapResult.oneOf.map((entry: { $ref: string }) => entry.$ref),
      [
        '#/components/schemas/StoneMapResultV1',
        '#/components/schemas/StoneMapResultV2',
        '#/components/schemas/StoneMapResultV3',
        '#/components/schemas/StoneMapResultV4',
        '#/components/schemas/StoneMapResultV5',
      ],
    );
  });

  /**
   * The spec is the shape a consumer integrates against, so a version the code
   * accepts and the spec never mentions is a lie by omission. This drifted by
   * two whole contract versions — 4.0 and 5.0, the second of which is the only
   * mutable one and the one actually deployed — because nothing here compared
   * the two lists.
   */
  it('documents every contract version the code supports', async () => {
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    const { AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS } = await import(
      '../../../lib/ai-contract'
    );

    const documented = Object.keys(
      spec.components.schemas.StoneMapResult.discriminator.mapping,
    ).sort();
    assert.deepStrictEqual(
      documented,
      [...AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS].sort(),
      'StoneMapResult must document exactly the contract versions Core accepts',
    );

    for (const [version, ref] of Object.entries(
      spec.components.schemas.StoneMapResult.discriminator.mapping as Record<
        string,
        string
      >,
    )) {
      const schemaName = ref.split('/').pop()!;
      assert.strictEqual(
        spec.components.schemas[schemaName]?.properties?.contractVersion
          ?.enum?.[0],
        version,
        `${schemaName} must pin contractVersion to ${version}`,
      );
    }
  });

  it('should document organization-scoped manager authentication', () => {
    const fileContent = fs.readFileSync(openapiPath, 'utf8');
    const spec = JSON.parse(fileContent);
    const managerOperations = [
      spec.paths['/api/rounds'].get,
      spec.paths['/api/rounds'].post,
      spec.paths['/api/manager/setup'].put,
      spec.paths['/api/rounds/{roundId}'].patch,
      spec.paths['/api/rounds/{roundId}/survey-definition'].get,
      spec.paths['/api/rounds/{roundId}/survey-definition'].put,
      spec.paths['/api/rounds/{roundId}/analytics'].get,
      spec.paths['/api/rounds/{roundId}/ai-insights'].get,
      spec.paths['/api/rounds/{roundId}/trigger-ai'].post,
    ];

    // The HTTP Basic fallback was removed with the manager session rollout:
    // the spec must describe the session that actually guards these routes.
    assert.strictEqual(spec.components.securitySchemes.basicAuth, undefined);
    assert.ok(spec.components.securitySchemes.managerSession);
    for (const operation of managerOperations) {
      assert.deepStrictEqual(operation.security, [{ managerSession: [] }]);
      assert.ok(
        operation.responses['403'] || operation.responses['404'],
        'Scoped manager operations must document a hidden or forbidden foreign resource',
      );
    }
  });

  it('keeps the versioned AI schemas synchronized in JSON and YAML', () => {
    const jsonSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    const yamlSpec = yaml.load(
      fs.readFileSync(
        path.join(process.cwd(), 'docs', 'openapi.yaml'),
        'utf8',
      ),
    );
    const aiSchemas = [
      'RoundAnalyticsResult',
      'RoundAnalyticsResultV2',
      'RoundAnalyticsResultV3',
      'QuestionAggregate',
      'DynamicQuestionAggregate',
      'StoneMapResult',
      'StoneMapResultV1',
      'StoneMapResultV2',
      'StoneMapResultV3',
      'StoneMapResultV4',
      'StoneMapResultV5',
      'StoneDetail',
      'StoneDetailV3',
      'StoneDetailV4',
      'StoneDetailV5',
      'StoneMetric',
      'StoneMetricV5',
      'StoneIntervention',
      'StoneInterventionV5',
      'StoneGenerationProvenance',
      'StoneGenerationProvenanceV3',
      'StoneGenerationProvenanceV4',
      'StoneGenerationProvenanceV5',
      'RoundAnalyticsResultV4',
      'RoundAnalyticsResultV5',
      'ScoreDistribution',
      'QuestionAggregateV5',
    ];

    for (const schemaName of aiSchemas) {
      assert.deepStrictEqual(
        yamlSpec.components.schemas[schemaName],
        jsonSpec.components.schemas[schemaName],
        `${schemaName} must stay synchronized between JSON and YAML`,
      );
    }
  });
});
