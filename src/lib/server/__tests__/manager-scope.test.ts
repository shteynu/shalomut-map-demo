import assert from "node:assert/strict";
import test from "node:test";
import {
  createScopedManagerHeaders,
  MANAGER_ORGANIZATION_HEADER,
} from "../manager-scope";

test("manager scope headers replace a client-supplied organization", () => {
  const requestHeaders = new Headers({
    [MANAGER_ORGANIZATION_HEADER]: "org-attacker",
  });

  const scopedHeaders = createScopedManagerHeaders(
    requestHeaders,
    "org-school-a",
  );

  assert.strictEqual(
    scopedHeaders.get(MANAGER_ORGANIZATION_HEADER),
    "org-school-a",
  );
});

test("unscoped routes remove a client-supplied organization", () => {
  const requestHeaders = new Headers({
    [MANAGER_ORGANIZATION_HEADER]: "org-attacker",
  });

  const scopedHeaders = createScopedManagerHeaders(requestHeaders);

  assert.strictEqual(
    scopedHeaders.get(MANAGER_ORGANIZATION_HEADER),
    null,
  );
});
