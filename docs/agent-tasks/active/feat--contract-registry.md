# Task: Feature - Contract Registry

## Status
- **Current HEAD**: b85d504 chore(auth): close dormant branches and unify tenant auth with Phase E
- **Branch**: `feat/contract-registry`
- **State**: Done

## Planned Work (Phase C)
- Extract all version-specific capability logic into a Contract Registry (TS and Python).
- Remove hardcoded exact version comparisons in both environments.
- Introduce `golden_corpus.json` as a shared test fixture.
- Implement architecture fitness allowlist to ban version string comparisons.
- Dummy 6.0 validation

## Verification
- Both TS (`npm test`) and Python (`node scripts/verify-ai.mjs`) test suites pass.
- Verified adding new capabilities (6.0) works as intended without any business logic changes.
- Architecture fitness checking works on both environments.

## Git State
Uncommitted changes exist in TS and Python source files and golden corpus. Preparing to commit and push.

## Next concrete step
- Commit and push to main, as instructed by user: "запуши все в мэин по порядку чтобы не было конфликтов".
