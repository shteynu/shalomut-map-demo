/**
 * Types for `ai-service-python.mjs`, which stays plain JavaScript so that the
 * scripts running under bare `node` can import it. TypeScript callers — the
 * cross-service test under `src/**\/__tests__` and the `tsx` scripts — resolve
 * this declaration instead.
 */

export declare const repositoryRoot: string;
export declare const aiServiceRoot: string;

export declare function findAiServicePython(): string | null;
export declare function requireAiServicePython(purpose: string): string;
