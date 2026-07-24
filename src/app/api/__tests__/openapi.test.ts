import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

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
    assert.ok(schemas.RoundDimensionScore, 'Must include RoundDimensionScore schema');
    assert.ok(schemas.WellbeingDimensionId, 'Must include WellbeingDimensionId schema');
    assert.ok(schemas.StoneMapResult, 'Must include StoneMapResult schema');
    assert.ok(schemas.StoneDetail, 'Must include StoneDetail schema');
    assert.strictEqual(schemas.StoneMapResult.properties.contractVersion.example, '1.0');
  });
});
