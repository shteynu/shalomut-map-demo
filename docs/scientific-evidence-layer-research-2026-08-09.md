# Scientific Evidence Layer — codebase research, 2026-08-09

> **Status: not for implementation.** This document exists to be discussed with
> the product owner. Nothing in it is scheduled, approved or agreed, and no code
> follows from it. The alternatives in section 4 are deliberately unranked and
> the decisions in section 5 are open. Do not treat any part of this file as a
> specification, and do not start an implementation task from it before those
> decisions are answered.

This is a read-only study of what the code does today, written to answer one
question: **where does the current decision pipeline lack scientific evidence,
and what is the smallest new component that would remove precisely that lack?**

It is not an implementation plan and it does not choose a winner. It ends with
three architectural alternatives and the decisions that only the owner can make.

Defects and drift found along the way are deliberately **not** here. They are a
separate, deferred list in
[`ai-service-incidental-findings-2026-08-09.md`](ai-service-incidental-findings-2026-08-09.md),
so that a decision about a new capability is never entangled with a decision to
repair the existing one.

Method: twelve parallel read-only investigations over `ai-analytics-service/`,
`contracts/`, `src/`, `prisma/` and `docs/`, followed by a completeness pass and
an adversarial pass that re-opened the load-bearing claims and executed the
shipped validators rather than reading them. Every claim below carries a
`path:line` citation. Where a track's number was wrong, the corrected number is
what appears here.

---

## 1. Current state

### 1.1 The pipeline is a hand-written loop, not a graph framework

`AnalyticsGraphEngine.ainvoke` is a `while True` loop
([graph.py:68-166](../ai-analytics-service/src/agents/graph.py#L68)) with no
LangGraph and no checkpointer — `requirements.txt` is four lines: fastapi,
uvicorn, pydantic, httpx. The stages are:

```text
privacy_gate → psychologist → rag_intervention → adaptation → safety
             → (loop, ≤3 replays) → format_output → outgoing_refusal gate
```

Of the six functions the code calls nodes, **exactly two are agentic**:
`agent_psychologist_node` (four provider operations) and
`agent_adaptation_node` (one, and only when the contract declares
`supportsAdaptationOutcome`,
[intervention_nodes.py:84-87](../ai-analytics-service/src/agents/intervention_nodes.py#L84)).
The privacy gate, the intervention node, the safety validator and the formatter
are deterministic.

**Every fact about the round exists before any node runs.** The initial state is
built in
[analytics_runner.py:59-82](../ai-analytics-service/src/services/analytics_runner.py#L59)
with `round_data` already holding dimension scores, every question aggregate
with Hebrew text and (on 5.0+) a green/yellow/red distribution,
`backgroundContext` and `surveyDefinitionHash`. Nothing about the school arrives
later. What arrives later is only this service's own prose.

### 1.2 The two halves of the pipeline never meet

This is the single most consequential structural fact in the study.

`agent_rag_intervention_node` and `src/rag/store.py` contain **zero** references
to `interpretations`
([intervention_nodes.py:23-74](../ai-analytics-service/src/agents/intervention_nodes.py#L23)).
The model's reading of the round is produced, validated and shipped without ever
influencing which interventions are chosen. `agent_adaptation_node` likewise
never reads it — it only rewrites the catalog text it was handed.

Intervention selection today is a pure function of numbers and Hebrew question
wording.

### 1.3 "RAG" is a name over a `json.load`

`LocalInterventionVectorStore` performs no vector search. `chroma` is not a
dependency; it appears six times in the repository and not one is an import —
`.env.example:78`, a README line stating it is **not** used at runtime, a
PKG-INFO copy of that line, [config.py:270](../ai-analytics-service/src/config.py#L270)
(assigned, never read) and two dead constructor lines
([store.py:35-38](../ai-analytics-service/src/rag/store.py#L35)).

Selection is a hard filter — `dimension_id` equal and `computedStatus` in
`target_status`, no backfill across either boundary
([store.py:248-256](../ai-analytics-service/src/rag/store.py#L248)) — followed by
three additive terms
([store.py:263-284](../ai-analytics-service/src/rag/store.py#L263)):

| Term | Weight | What it reads |
| --- | --- | --- |
| topic match | `3.0 × Σ(severity × rarity)` | Hebrew question text vs catalog text, through a 19-topic lexicon |
| polarization lean | `2.0 × (2p − 1) × reach_lean` | the score distribution; absent on 3.0/4.0 |
| background tags | flat `+5.0` per match | two rules only: `sicknessDaysThisQuarter > 3`, `newStaffMembers > 2` |

Ties break on original catalogue file order (`(score, -index)`, sorted reverse).
The only semantic machinery in the system is
[topics.py](../ai-analytics-service/src/rag/topics.py) — a closed Hebrew keyword
lexicon of **19 topics over 208 distinct word forms** with a prefix stripper.

The ranking is fully deterministic: no embeddings, no network, no randomness, no
seed needed. The derived signals (per-question topics, severity, polarization,
topic rarity, the score itself) are computed inside
`get_interventions_for_dimension` and **thrown away** — only the top-N entries
survive.

Two properties matter for anything built on top of this:

- The weights are **unnormalised**. One background-tag match (`+5.0`) is worth
  roughly the entire spread of the topic term across a candidate pool. A fourth
  term added without calibration would silently dominate.
- Catalogue order is **silently load-bearing** and nothing pins it. Shipped-catalog
  tests assert sets, counts and uniqueness — never an order
  ([test_rag_store.py](../ai-analytics-service/tests/test_rag_store.py)). A
  re-ranking change would move deployed recommendations with every test green.

### 1.4 What the catalog actually is

`data/interventions_kb.json`: **192 entries**, perfectly uniform — nine keys
each (`id`, `dimension_id`, `source`, `title`, `summary`, `actionable_steps`,
`target_status`, `intent`, `tags`), unique ids, exactly **24 pools of exactly 8**
(8 dimensions × 3 statuses), 128 `improve` / 64 `preserve`.

The retrieval unit is very small: title 14–34 characters, summary 43–116
(median **61** — one Hebrew sentence), and `actionable_steps` has length exactly
2 in all 192 entries.

Provenance per entry is one free-text Hebrew `source` string drawn from **10
distinct values across 192 entries** — the largest covers 48 entries, the next
24, then eight at 15 each. They name ISO 45003 clauses and OECD/TALIS
frameworks. There is no DOI, year, study type, population, sample size, effect
size or evidence grade on any entry.

Two things follow that the plan's framing should absorb:

- The named sources are **guidance standards and survey programmes, not
  intervention-effectiveness literature.** Nothing in the catalog asserts that
  any listed intervention has been shown to work.
- Because one `source` value covers 48 entries, the label identifies a document,
  not a claim. It cannot be traced to a finding.

### 1.5 What the model does, and what it costs

On contract 6.0 a normal round makes **exactly 25 provider calls**: 8 structured
summaries + 8 metric-insight batches + 1 overall summary + 8 adaptation batches
([psychologist_node.py:100-131, 252-296, 317-330](../ai-analytics-service/src/agents/psychologist_node.py#L100);
[intervention_nodes.py:142-150](../ai-analytics-service/src/agents/intervention_nodes.py#L142)).
On 5.0 it is 17; on 3.0/4.0 it is 8. Worst case under the 3-replay loop is four
loop bodies — at most ~100 generation calls and ~300 HTTP attempts.

Concurrency is `LLM_MAX_CONCURRENT_REQUESTS`, default **2**. The real serializer
is a per-model rate-limiter queue. Temperature is a hardcoded 0.2; there is no
seed, no response-format mode, no caching anywhere, and no token or cost
accounting. The lease is 90 s with a 30 s heartbeat that runs concurrently, so
a slow dependency does not threaten the lease — but the per-round wall clock is
already dominated by pacing.

Note the comment at
[config.py:223-224](../ai-analytics-service/src/config.py#L223) saying "a round
is roughly 33 calls" is **stale** — it describes the pre-batching design.
Planning from it overstates today's cost by about a third.

On 6.0 the whole intervention dict — including `source` — is serialised into the
adaptation prompt with `json.dumps`
([hebrew_prompts.py:497-521](../ai-analytics-service/src/services/hebrew_prompts.py#L497)).
Any field added to `StoneIntervention` becomes model-visible on 6.0 with **zero
prompt change and no instruction governing it**.

### 1.6 What the manager actually reads

An intervention arrives on the wire with eight fields (`id`, `dimensionId`,
`status`, `source`, `title`, `summary`, `actionable_steps`, `adaptationOutcome`)
and leaves Core's mapper as exactly two:
`toDashboardRecommendations` emits `{title, body}`
([ai-insights-view-model.ts:145-168](../src/lib/ai-insights-view-model.ts#L145);
[dashboard-insights.ts:36-39](../src/lib/dashboard/dashboard-insights.ts#L36)).
`source` is validated on arrival as `typeof === 'string'`
([ai-contract.ts:246](../src/lib/ai-contract.ts#L246)) and then **never read
again anywhere in `src/`**.

The visible body must be 300–500 characters. Against a 61-character catalog
seed, roughly **four fifths of what the principal reads is generated, not
catalog**. The deterministic fallback makes this explicit: five sentences, of
which exactly one is the catalog summary
([hebrew_prompts.py:523-556](../ai-analytics-service/src/services/hebrew_prompts.py#L523)).

Displayed priority is array index — Core adds no ranking of its own
([dashboard-recommendations-page.tsx:184](../src/components/dashboard/dashboard-recommendations-page.tsx#L184)).

### 1.7 The output surface cannot carry a citation today

`is_hebrew_only_copy`
([hebrew_validation.py:158-175](../ai-analytics-service/src/services/hebrew_validation.py#L158))
refuses any non-Hebrew **letter** and is indifferent to digits. Executed against
citation-shaped strings it accepts `המחקר משנת 2019...` and `לפי מקור [12]...`,
and refuses `doi:10.1037/...`, a URL, `OECD TALIS 2018` and the real catalog
string `ISO 45003:2021, סעיף 6.1.2.4 — …`. On top of that, a 6.0 visible body
must be 300–500 characters with **no digits and no percent signs**
([hebrew_validation.py:178-191](../ai-analytics-service/src/services/hebrew_validation.py#L178)),
mirrored in Core at
[ai-contract.ts:374-384](../src/lib/ai-contract.ts#L374).

`source` ships only because it is deliberately excluded from the validated set —
`user_facing_copy` is built from title, summary and steps only
([safety_node.py:176-180](../ai-analytics-service/src/agents/safety_node.py#L176)).
All 192 `source` strings would fail `is_hebrew_only_copy`.

### 1.8 What is recorded, and what is lost

`generation_provenance` is per-dimension and is about **who wrote the words**,
not what backed them
([state.py:48-61](../ai-analytics-service/src/agents/state.py#L48)). It travels
to the wire and into the database. Persistence is a frozen payload: Core stores
the validated object whole in `AiAnalysisRun.result` and `SurveyRound.aiInsights`
([prisma/schema.prisma:40, 117](../prisma/schema.prisma#L100)), and a months-old
report is re-read, not recomputed.

Not recorded anywhere: the ranking score, the catalog version, the
pre-adaptation catalog text, the prompt, the raw model output, the model
name/version, token counts or cost. The chain "why was intervention X
recommended to this school?" therefore reconstructs to:

| Link | Recoverable today? |
| --- | --- |
| school analytics → problem signals | Yes — echoed in `metrics` and `sourceQuestionIds` |
| signals → ranking inputs | Partly — aggregates yes; `backgroundContextIncluded` is unreliable (see §3.4) |
| ranking → why this candidate won | **No** — the score is a local tuple, never logged, never stored |
| selected intervention identity | Yes — `id` survives to the payload and the DB |
| catalog state at the time | **No** — `interventions_kb.json` is unversioned and unhashed |
| pre-adaptation text | **No** — overwritten in place |
| LLM adaptation | Only as an outcome enum (`llm` / `deterministic_fallback`) |
| final output | Yes — frozen JSON |

### 1.9 What the product already claims

A scientific-evidence capability has **never** been specified, planned, promised
or deferred anywhere in this repository. A repo-wide search for the vocabulary
(peer-review, meta-analysis, DOI, PubMed, Crossref, systematic review, effect
size, evidenceLevel, studyType, citation) returns one hit: the task file created
for this research. `ROADMAP.md` declares both next-outcome lists "None open".

What does exist is an *institutional* claim made outside the code:
`docs/product-requirements-summary.md:58` names an academic department as
scientific supervisor of the instrument, `:19` promises the principal
"recommendations of experts", and `:43` grounds the eight dimensions in
organizational-psychology methodology and OECD-like standards. **None of that
authority is represented in any runtime artifact.**

Meanwhile the generative side is deliberately confined: every prompt says
"base every claim on the data above"
([hebrew_prompts.py:260](../ai-analytics-service/src/services/hebrew_prompts.py#L260)),
two global rules forbid clinical vocabulary and asserted causes
([hebrew_prompts.py:50-63](../ai-analytics-service/src/services/hebrew_prompts.py#L50)),
and the project's own quality vocabulary already redefines the word: the
`evidence_specificity` grader measures overlap with **this round's own question
texts** ([evals/graders.py:327-334](../ai-analytics-service/evals/graders.py#L327)).

---

## 2. The evidence gap

There is not one gap. There are four, and they are separable — which matters,
because the cheapest of them is a content project and the most expensive is an
architecture project.

**Gap A — selection is uninformed by anything but wording and severity.**
Which intervention a school is shown is decided by Hebrew keyword overlap, a
distribution reading, and two numeric tags that can touch at most 11 of 192
entries. No signal about whether an intervention *works* participates in that
decision, because no such signal exists in the data. This is the gap the plan's
framing points at, and it lives entirely in
[store.py:263-284](../ai-analytics-service/src/rag/store.py#L263) — with no
contract, no network and no model involved.

**Gap B — the authority label is decorative and invisible.**
`source` exists end-to-end and is dropped at the DTO. Even if it were shown, it
names a standards document shared by up to 48 entries; it cannot support a
sentence like "this is recommended because study X found Y". The product
promises expert recommendations in its requirements and delivers an unshown,
coarse, unvalidated string.

**Gap C — a recommendation is not reconstructable.**
Three links of the audit chain are lost at the moment they are computed (§1.8).
Adding evidence without fixing this produces citations nobody can verify were
actually used.

**Gap D — the visible surface cannot express a citation.**
Hebrew-letters-only plus no-digits makes an inline citation mechanically
impossible in every user-facing field. This is not an oversight to route around;
it is the product's Hebrew-first invariant
([dashboard-semantic-contract.md](dashboard-semantic-contract.md)) meeting a
Latin, numeric artifact.

### Where evidence is *not* obviously missing

The interpretation path. The product deliberately restricts the psychologist's
copy to this school's own aggregates and explicitly forbids asserted causes.
Feeding literature into that node would blur exactly the boundary the prompts
exist to hold — "what this school's data shows" versus "what the literature
says". The plan's question 2 is answered by the code's own posture: evidence
belongs on the **recommendation** side, where the product is already making a
normative claim on borrowed authority, not on the **interpretation** side, where
it is deliberately making none.

### The honest risk

Every quality gate in this product measures grounding in the round's own data,
precisely because ten aggregate answers support very little. Attaching citations
to that raises apparent authority without raising actual support — and it does so
on 192 entries that have **no named owner, no reviewer, no review step and no
approval gate** anywhere in the repository, authored by a single Git author.
Citations increase the cost of that absence rather than reducing it.

---

## 3. Existing extension points

### 3.1 Cheap and already-shaped

| Point | Location | What it allows |
| --- | --- | --- |
| Catalog schema is unvalidated | [store.py:42-55](../ai-analytics-service/src/rag/store.py#L42) — bare `json.load` | Adding evidence fields to all 192 entries breaks nothing; unknown keys are loaded and ignored |
| `_background_score(item, context) -> float` | [store.py:215-231](../ai-analytics-service/src/rag/store.py#L215) | The **only existing precedent** for the score reading a declared structured field instead of derived Hebrew text. A second helper of the same shape is a pure, testable addition |
| A fourth additive term | [store.py:263-281](../ai-analytics-service/src/rag/store.py#L263) | An evidence signal that stays offline, synchronous and deterministic — no contract involvement at all |
| `StoneIntervention.source` | [mcp_types.py:673-687](../ai-analytics-service/src/schemas/mcp_types.py#L673) → [ai-contract.ts:246](../src/lib/ai-contract.ts#L246) | The one wire field exempt from Hebrew-only rules. Already carries Latin, digits, colons and em-dashes and passes both runtimes today |
| `EvidenceSource` Protocol | [ports.py:19-100](../ai-analytics-service/src/application/ports.py#L19) | A duck-typed test double with no network, in the style the module already commits to. Zero cost on its own |
| Graph constructor injection | [graph.py:65-66](../ai-analytics-service/src/agents/graph.py#L65) | The exact precedent (`generator: TextGenerator = llm_provider_service`) for a second collaborator |
| `kb_path` constructor argument | [store.py:32-55](../ai-analytics-service/src/rag/store.py#L32) | A second fixed corpus file loaded exactly like the catalog; `data/` is already copied by [Dockerfile:22](../Dockerfile#L22) |

### 3.2 Contract-level, with a stated rule already covering it

ADR-002 (`PROJECT_CONTEXT.md:45-63`, owner decision 2026-08-05) permits an
**optional additive field** on a published version without a new version, on
five conditions — the field is optional, nothing existing changes, a prior
consumer keeps working, the addition is recorded in the manifest and the version
matrix, and the sequence is consumer-first.

That rule is satisfiable here, because the wire is genuinely open:

- There is **no zod** in the repository; Core validates with hand-written type
  guards that "accept unknown fields" — stated twice in the source
  ([ai-contract.ts:450, :521](../src/lib/ai-contract.ts#L448)).
- Neither `docs/openapi.yaml` nor `public/openapi.json` contains a single
  `additionalProperties: false`.
- The callback persists `structuredClone(validation.value)` — the validated
  object itself, not a projection
  ([ai-insights-service.ts:173-176](../src/lib/server/ai-insights-service.ts#L173)).

Related points: `generation_provenance` is the established home for "how this
copy came to be", already amended three times without a version break in spirit;
`contracts/capabilities.json` is the only machine-read per-version policy file
and is **fail-closed** — a flag added there without a matching field on
`ContractCapabilities` crashes the service at import
([contract_registry.py:6-32](../ai-analytics-service/src/schemas/contract_registry.py#L6)).

`surveyDefinitionHash` is the working precedent for corpus versioning: a sha256
over a canonical projection, computed independently by both runtimes, carried on
the wire, refused on mismatch, stamped into per-dimension provenance.
`interventions_kb.json` has no equivalent and nothing detects its drift.

### 3.3 Validation and failure machinery that already exists

- **Id-echo gate.** `parse_v6_intervention_batch` refuses the batch unless block
  *i* echoes catalog entry *i*'s `id` exactly
  ([hebrew_validation.py:291-292](../ai-analytics-service/src/services/hebrew_validation.py#L291)).
  This is the working template for "the model may only reference identifiers the
  service chose". It exists **only on the 6.0 path**; on ≤5.0 the prompt carries
  no ids and the parse is positional.
- **Violation → critique → replay.** A new rule needs a code string, one of three
  targets, and one Hebrew critique line
  ([safety_report.py:21-132](../ai-analytics-service/src/agents/safety_report.py#L21));
  the existing loop then routes it to the right prompt on a heavier tier.
- **`_REPAIRABLE` table.** A payload-level rule listed there becomes repairable
  by the same 3-replay budget; omitted, it fails the round by design
  ([stone_map_validation.py:199-244](../ai-analytics-service/src/schemas/stone_map_validation.py#L199)).
- **Stated-gap degradation.** `_degrade_to_partial_map`
  ([graph.py:169-239](../ai-analytics-service/src/agents/graph.py#L169)) is the
  codebase's closest analogue to "no supporting evidence found" — a dimension
  reported as a declared gap inside a `status: success` payload, with a reason
  enum and existing Hebrew copy on two screens.
- **Deterministic fallback.** When the model does not answer, derived copy is
  substituted and labelled in provenance; the round still succeeds. The only
  genuinely optional inputs today are `backgroundContext` and `scoreDistribution`,
  whose absence is recorded as provenance booleans and fails nothing.
- **Config gate.** `Settings` + `runtime_configuration_errors()` is fail-closed
  at startup ([config.py:353-421](../ai-analytics-service/src/config.py#L353)) —
  the pattern `USE_MOCK_MCP` and `AI_JOB_POLLING_ENABLED` follow.
- **Test seams.** `contracts/fixtures/callback_corpus.json` (7 accepted, 19
  refused cases naming 13 distinct rules) is enforced in **both** runtimes;
  `hebrew_text_corpus.json` is the cheapest dual-runtime rule corpus shape; the
  eval harness takes a new grader as one pure function plus one tuple entry
  ([evals/graders.py:489-495](../ai-analytics-service/evals/graders.py#L489)).
- **Provenance UI affordance.** `.dashboard-blob-provenance` with `role="note"`
  exists on two screens — but **not** on the recommendations screen.

### 3.4 Hazards a design must route around

1. **`asdict` emits nulls on every version at once.** `StoneIntervention.to_dict`
   is a bare `asdict(self)` with no None filter, unlike the dataclass directly
   above it ([mcp_types.py:665-671 vs 673-687](../ai-analytics-service/src/schemas/mcp_types.py#L665)),
   and `encode_stone_map` passes interventions through verbatim
   ([analytics_output.py:76](../ai-analytics-service/src/schemas/analytics_output.py#L76)).
   An `Optional` field added there ships `"evidence": null` on contracts 1.0–6.0
   simultaneously, with no capability gate. This is also the only part of the
   stone the encoder does not project field by field — the natural home for a
   version branch that has never been needed.
2. **The outgoing gate never reads interventions.** `stone_map_refusal` inspects
   score, status, provenance, summaries and metrics and never touches
   `recommendedInterventions`
   ([stone_map_validation.py:68-127](../ai-analytics-service/src/schemas/stone_map_validation.py#L68)).
   The Python side is *less* strict than the Core gate it mirrors, so an
   intervention-level defect is caught only at the callback — after every model
   call is paid for.
3. **A test allowlist blocks the first real citation.**
   `ALLOWED_SOURCE_CITATIONS = {ISO, OECD, TALIS}`
   ([test_rag_store.py:47](../ai-analytics-service/tests/test_rag_store.py#L47))
   fails on any author name, journal or DOI — a red test whose stated purpose has
   nothing to do with the change.
4. **`backgroundContextIncluded` is effectively always true** on 4.0+, because
   `_background_context_for_prompt` falls back to `org_context`
   ([node_support.py:88-97](../ai-analytics-service/src/agents/node_support.py#L88))
   and the runner always seeds it with `organizationId`. Any design reading that
   flag as "the school gave us context" reads noise.
5. **The stale docstring at
   [stone_map_validation.py:1-18](../ai-analytics-service/src/schemas/stone_map_validation.py#L1)**
   says nothing calls the outgoing gate yet. It has been live at
   [graph.py:136](../ai-analytics-service/src/agents/graph.py#L136) for some time.
   Reasoning from the docstring gives the opposite of the truth about where a new
   rule must go.
6. **No cache, and no convention to copy.** Zero hits for `lru_cache`,
   `functools`, `redis`, `cachetools` in the service. A per-`(dimension, status)`
   lookup would repeat up to 8× per round and again on every replay.
7. **CI is network-free only by accident** — the transport short-circuits on a
   missing API key and there is no socket guard in `conftest.py`. A networked
   lookup at test time would be the first thing in the 463-test suite able to fail
   for reasons unrelated to the code.
8. **`evals/` is not shipped** ([Dockerfile:20-23](../Dockerfile#L20)). A corpus
   the deployed service must read has to live under `contracts/` or
   `ai-analytics-service/data/`.
9. **Goals lose the link.** `RoundGoal` copies title and body only and matches
   recommendations by title string
   ([prisma/schema.prisma:66-85](../prisma/schema.prisma#L57);
   [goal-rows.ts:38](../src/lib/dashboard/goal-rows.ts#L38)). Evidence attached to
   a recommendation is lost the moment a manager tracks it as a goal.
10. **Promoting `source` to an object is breaking.** `isLegacyIntervention`
    requires `source` to be a plain string on **every** version V1–V6
    ([ai-contract.ts:246](../src/lib/ai-contract.ts#L246)).

### 3.5 How the corpus would be updated today

The catalog is a build artifact, not runtime data: `COPY ai-analytics-service/data ./data`
([Dockerfile:22](../Dockerfile#L22)) into a `runtime: docker` Render service
([render.yaml:11-16](../render.yaml#L11)), loaded once at import into a
module-level singleton, with no writer, no admin route and no hot reload.
Updating the corpus means committing JSON and redeploying.

---

## 4. Architectural alternatives

Three options, ordered by how much of the architecture they disturb. No winner is
proposed; each answers a different question, and §5 lists the decisions that pick
between them.

### Alternative A — Provenance-first, no new dependency

Enrich the existing 192 entries offline with structured fields (source id, study
or standard type, population, year, applicability notes), version the catalog with
a hash on the `surveyDefinitionHash` model, add a fourth deterministic ranking
term reading those declared fields via a `_background_score`-shaped helper, and
surface the citation through the already-shipped `source` neighbourhood plus a
per-dimension provenance record.

- **Touches:** `interventions_kb.json`, `store.py`, `StoneIntervention`,
  `generation_provenance`, the Core DTO and one screen. One optional additive
  field under ADR-002; no new contract version required.
- **Keeps:** determinism, offline CI, zero latency, zero cost per round,
  reproducibility, the existing test seams.
- **Costs:** a content project across 192 entries; the ranking-term calibration
  problem (§1.3); the test allowlist and the `asdict` null hazard; and it does not
  answer "what does the literature say about this school's situation" — it answers
  "what is this catalog entry based on".
- **Answers:** Gap B and Gap C fully, Gap A partially, Gap D only if the citation
  rides in a `source`-like field exempt from the Hebrew rules.

### Alternative B — An injected `EvidenceSource` inside the existing intervention node

Add a Protocol to `ports.py`, replace the module-level `vector_store` singleton
with a collaborator injected through `AnalyticsGraphEngine.__init__`, and let the
node consult an evidence corpus — initially a bundled file loaded like the
catalog, later swappable for a network source without touching the node.

- **Touches:** `ports.py`, `intervention_nodes.py:20` (the singleton),
  `graph.py:65,95`, every caller of `analytics_graph`, plus configuration.
- **Keeps:** one pipeline stage, one call site, the existing replay semantics;
  substitution in tests becomes first-class (today the only seam is a constructor
  argument the pipeline never passes).
- **Costs:** the engine's stated invariant is that it owns *one* collaborator
  ([graph.py:61-63](../ai-analytics-service/src/agents/graph.py#L61)) — a second
  is a deliberate change. The node is synchronous; a network source makes it
  async or blocking, inside a loop that runs up to four times, with no cache. A
  failure policy must be chosen: the node cannot fail a round today, and the
  engine has exactly three failure exits, none of which fits a new component.
- **Answers:** Gap A directly and cleanly, Gap C if the retrieval result is
  recorded, Gap B and D as a follow-on.

### Alternative C — Retrieval as its own stage before the loop

A deterministic node between the privacy gate and the `while` loop
([graph.py:70-75](../ai-analytics-service/src/agents/graph.py#L70)) that writes
`evidence_by_dimension` into state once per round — after the gate has confirmed
the round may be read and before any provider spend. All round facts are already
present at that point (§1.1). Optionally the source lives behind its own MCP
server, mirroring how Core already serves round analytics.

- **Keeps:** the retrieval cost paid **once**, not up to four times; the evidence
  available to both the interpretation path and the intervention path; a clean
  isolation boundary if MCP is used.
- **Costs:** state grows a key that both nodes may read, and today there is no
  separation between transient working data and payload-bound data — the formatter
  reads four state keys and interventions pass through unprojected, so "internal
  only" is a discipline, not a mechanism. MCP in this project means exactly one
  thing — Core is the server, Python is the client, inbound data only
  ([src/app/api/mcp/route.ts](../src/app/api/mcp/route.ts);
  [client.py:93](../ai-analytics-service/src/mcp_client/client.py#L93)) — so a
  literature MCP server would be a second, opposite-direction use of a boundary
  that currently has one meaning. And MCP failure escapes before the runner's
  try/except, so it delivers no failure payload at all — Core sees only
  `worker_error`, which is not re-armable
  ([trigger-ai-analytics.ts:45,107](../src/lib/server/trigger-ai-analytics.ts#L45)).
- **Answers:** Gap A and Gap C, at the highest architectural cost and the highest
  operational risk.

### The option the code argues against

"One LLM call per dimension to find and assess evidence" is the shape the plan
invites and the codebase resists. Query formulation, filtering, reranking and
applicability all have deterministic analogues here already
(`topics_for_text`, `_question_severity`, `_round_polarization`,
`_background_score`), and the model's role in this product is narrowly and
deliberately "write the Hebrew". Adding 8 more paced calls to a round already
dominated by pacing, inside a loop that can run four times, buys
non-reproducibility in the one part of the pipeline that is currently exactly
reproducible.

### Deterministic vs LLM, stage by stage (plan question 10)

| Stage | Verdict from this codebase |
| --- | --- |
| Query formulation | Deterministic. `topics_for_text` already reduces free Hebrew text to a closed 19-topic vocabulary |
| Retrieval | Deterministic if the corpus is local; a network source is an architecture decision, not a model one |
| Filtering | Deterministic. The existing dimension/status hard filter is the precedent |
| Reranking | Deterministic. Three additive weighted terms already do exactly this |
| Findings extraction | Depends entirely on the unit: structured fields → ordinary code; prose abstracts → a model |
| Evidence-quality assessment | Should be **declared** metadata, not inferred. Inferring it is where hallucinated authority enters |
| Applicability assessment | Deterministic and *thin* — the system knows construct, severity, socio-economic band, rough grade range and two counters, and nothing else (§below) |
| Summarization | The model's existing job. It already rewrites catalog text into Hebrew and is validated for it |

**Applicability, precisely.** The entire school model is nine values: five on
`Organization` (name, city, `schoolType`, `totalStaffCount`, id) and seven inside
per-round `backgroundContext` (notes, audience, `sicknessDaysThisQuarter`,
`newStaffMembers`, `studentCount`, `socioEconomicIndex`, `classesPerGrade`).
**None of the organization-level fields cross the MCP boundary** — the payload is
a closed schema carrying `organizationId` as an opaque UUID. Country, sector,
urban/rural, public/private, student age and language are not modelled anywhere;
`schoolType` is free-typed Hebrew that never leaves Core. So a layer that claims
to check a study's applicability would be checking construct and severity — not
population, system or setting.

**Caching, precisely.** The candidate pool is a pure function of
`(dimension_id, target_status)` — 24 combinations of exactly 8 entries — and the
per-item topic and rarity tables depend only on that pool. Everything
school-specific merely re-scores and truncates a fixed pool. So a hypothetical
evidence query is almost entirely school-independent, and the natural cache key
falls straight out of the code. There is simply no cache to put it in.

---

## 5. Decisions only the owner can make

1. **Visible or invisible?** Must a manager *see* a citation? Yes ⇒ the
   no-digits/no-Latin rule for visible copy has to change, which is a
   contract-version decision. No ⇒ nothing on the wire needs to change at all.
2. **Rank or justify?** Should evidence change *which* recommendation surfaces
   (a term in `store.py`) or explain the one that surfaced (provenance plus UI)?
   These are entirely different changes with almost no overlap.
3. **Enrich or retrieve?** Re-provenance the 192 hand-written entries (a content
   project the code supports almost for free) or retrieve literature at runtime
   (an architecture project with a new external dependency, a new failure mode,
   and reproducibility consequences)?
4. **Cite the seed or the prose?** The catalog unit is a 61-character sentence;
   the manager reads a 300–500-character body that is ~80% generated. Only the
   first is human-authored. Which one is the citation attached to?
5. **What language?** Citations are Latin with digits. Does the owner accept
   Latin bibliographic text on a Hebrew manager screen, or must every visible
   evidence string be a Hebrew rendering (which is what the 192 `source` strings
   already are)?
6. **Mandatory or graceful?** If an evidence source is unavailable, does the round
   fail (like `provider_unavailable`) or proceed with catalog-only
   recommendations? Today the intervention node cannot fail a round at all.
7. **No-evidence policy.** If a well-fitting intervention has no supporting
   evidence, does it stay, rank lower, or disappear? Note the trap: a 6.0 round
   requires 5 interventions per dimension from a pool of exactly 8, and a
   recommendation-target violation is explicitly **not** degradable to a stated
   gap — so removal risks failing the whole round after paying for every model
   call.
8. **Green dimensions.** Do the 64 `preserve` entries carry evidence too?
   "Evidence that this is worth keeping" is a different literature question.
9. **Acceptable sources and who approves.** No policy artifact exists. The only
   executable rule is a three-token test allowlist; the only prose rule is one
   line in a document the project's own lifecycle classifies as historical. And
   the catalog has no owner, no reviewer and no approval gate.
10. **Freeze or resolve live?** Must a months-old report show the evidence it
    showed then (freeze text into the payload) or may it resolve ids against the
    current corpus (which requires corpus versioning first)?
11. **Naming.** "Evidence" is already taken twice — `contracts/ai-analytics-v6.json`
    uses "Core-owned evidence fields" for recomputed numbers, and
    `evidence_specificity` means grounding in this round's questions. A new term
    is needed before either is overloaded.
12. **Budget.** No per-round latency, call-count or cost ceiling is stated
    anywhere, and no telemetry would show the increase.

---

## 6. Coverage of the research plan

| Plan question | Answered in |
| --- | --- |
| 1 place in pipeline | §1.1, §1.2, Alt. C |
| 2 what evidence should influence | §2 "Where evidence is not obviously missing" |
| 3 ranking | §1.3 |
| 4 intervention origin | §1.4 |
| 5 provenance | §1.8, §3.2 |
| 6 contracts and schemas | §3.2, §3.4.1 |
| 7 AnalyticsState | §1.1, Alt. C |
| 8 ports | §3.1, Alt. B |
| 9 node or service | §1.1, Alt. B vs C |
| 10 deterministic vs LLM | §4 table |
| 11 retrieval unit | §1.4, §1.6, decision 4 |
| 12 metadata | §1.4, §3.1, §4 table |
| 13 applicability | §4 "Applicability, precisely" |
| 14 which dimensions | §1.4 (all 8 run; 64 green entries), decision 8 |
| 15 caching | §4 "Caching, precisely", §3.4.6 |
| 16 evidence vs intervention | §1.4, §2 |
| 17 adaptation node | §1.5 |
| 18 citation integrity | §1.7, §3.3 (id-echo gate) |
| 19 evidence validation | §3.3, §3.4.2 |
| 20 failure modes | §3.3, Alt. B/C costs |
| 21 no evidence found | decision 7, §3.3 stated-gap precedent |
| 22 contradictory studies | §3.3 — nothing compares two statements today; no `confidence` field exists anywhere |
| 23 acceptable sources | §1.9, decision 9 |
| 24 corpus update | §3.5 |
| 25 offline testing | §3.3 test seams, §3.4.7-8 |
| 26 evaluation | §3.3 (5 graders exist; false-evidence rate and consistency map onto existing shapes; evidence quality and cost have no analogue) |
| 27 performance and cost | §1.5 |
| 28 MCP | Alt. C |
| 29 persistence | §1.8 |
| 30 reproducibility | §1.8 table |
