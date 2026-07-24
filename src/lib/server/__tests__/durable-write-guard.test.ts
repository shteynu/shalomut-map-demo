import assert from "node:assert/strict";
import test from "node:test";
import { isDurableWriteUnavailable } from "../durable-write-guard";

test("durable writes remain available in local development", () => {
  assert.strictEqual(
    isDurableWriteUnavailable({
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      DATABASE_URL: undefined,
    }),
    false,
  );
});

test("durable writes fail closed in production without a database", () => {
  assert.strictEqual(
    isDurableWriteUnavailable({
      NODE_ENV: "production",
      VERCEL_ENV: undefined,
      DATABASE_URL: undefined,
    }),
    true,
  );
});

test("durable writes remain available when a database is configured", () => {
  assert.strictEqual(
    isDurableWriteUnavailable({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      DATABASE_URL: "postgresql://configured",
    }),
    false,
  );
});
