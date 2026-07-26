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
    assert.ok(schemas.StoneDetail, 'Must include StoneDetail schema');
    assert.strictEqual(schemas.StoneMapResultV1.properties.contractVersion.example, '1.0');
    assert.strictEqual(schemas.StoneMapResultV2.properties.contractVersion.example, '2.0');
    assert.strictEqual(schemas.StoneMapResultV3.properties.contractVersion.example, '3.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV2.properties.contractVersion.example, '2.0');
    assert.strictEqual(schemas.RoundAnalyticsResultV3.properties.contractVersion.example, '3.0');
    assert.deepStrictEqual(
      schemas.RoundAnalyticsResult.oneOf.map((entry: { $ref: string }) => entry.$ref),
      [
        '#/components/schemas/RoundAnalyticsResultV2',
        '#/components/schemas/RoundAnalyticsResultV3',
      ],
    );
    assert.deepStrictEqual(
      schemas.StoneMapResult.oneOf.map((entry: { $ref: string }) => entry.$ref),
      [
        '#/components/schemas/StoneMapResultV1',
        '#/components/schemas/StoneMapResultV2',
        '#/components/schemas/StoneMapResultV3',
      ],
    );
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

    assert.ok(spec.components.securitySchemes.basicAuth);
    for (const operation of managerOperations) {
      assert.deepStrictEqual(operation.security, [{ basicAuth: [] }]);
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
      'StoneDetail',
      'StoneDetailV3',
      'StoneMetric',
      'StoneIntervention',
      'StoneGenerationProvenance',
      'StoneGenerationProvenanceV3',
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
