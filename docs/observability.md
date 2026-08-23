# Observability — what this product counts, where it goes, and who is told

**Living document.** It describes the shape that ships today. When the code and
this file disagree, the code is right and this file is the bug.

Two families of signal leave this product: **operational metrics**, eighteen
counters and durations emitted from the moments worth measuring, and **request
errors**, one record per server-side failure Next.js catches. Both go to two
places at once — a structured `console` line, and a row in `operational_events`.

Until 2026-08-23 there was only the line. The audit of 2026-08-21 put the cost
plainly: every one of these counters exists to catch a failure nobody is
watching for, and every one of them landed in a scrollback with no retention, no
query and no reader. A counter that cannot warn anyone is a counter that does
not exist.

## The write path

```
recordAiJobQueued(run)            reportRequestError(error, context)
        │                                    │
        ▼                                    ▼
    emit()  ──────────────────────────── sink()
        │                                    │
        ├── console.info  (JSON, one line)   ├── console.error (JSON, one line)
        │                                    │
        └── durable sink ────────────────────┘
                     │
                     ▼
            after(...) — never in front of the response
                     │
                     ▼
             operational_events
```

Three properties hold at every emit site, and each of them is a decision:

- **The write never runs in front of a response.** `after()` is what makes this
  safe on a serverless runtime — a floating promise races the function being
  frozen the moment the response is sent, and the row describing a failure is
  the row most likely to be lost that way. Outside a request scope (a script,
  a test, the worker's process) `after()` throws and a plain promise is correct,
  because nothing is about to freeze.
- **Observability cannot break what it observes.** Every emit site is in the
  middle of the product's real work — queueing a run, storing a response — and
  none of them is prepared for a counter to throw. A failure is swallowed to a
  log line, at the sink, at the scheduler and at the emit call.
- **The console lines stay.** Not as redundancy: the error family's worst case
  is a failure *caused by* the database, and then the durable copy is the one
  write that cannot land.

The sinks are pointed at a store by the composition root, which is the module
that knows which store this deployment has. The two emitting modules take no
repository argument on purpose — threading one to every emit site would put
observability in the signature of everything it watches.

## The table

`operational_events` holds both families, told apart by `kind`. One table
because they are read together — "what happened around the time this broke" is
one question — and because the alert then scans one index instead of unioning
two.

No foreign keys, for the reason `audit_events` has none: an event about a round
has to outlive the round, a cascade would delete exactly the evidence someone
came looking for, and a write that could fail on a stale id would let
observability break the thing it observes.

| Column | Metric | Request error |
| --- | --- | --- |
| `kind` | `metric` | `request_error` |
| `name` | the counter's name | the error's class |
| `value`, `unit` | the reading | null |
| `labels` | the metric's labels | null |
| `run_id`, `round_id` | when the metric has them | null |
| `detail` | null | digest, message, stack, path, method, route |

The stored errors carry messages and stacks, and in a development build a
message can hold query text or row contents — which is why `src/app/error.tsx`
shows a digest instead of a message. Those rows are reachable with the database
and through no endpoint in the product: neither observability endpoint returns
any event's contents.

## What is alerted on

Four readings over three concerns, chosen with the owner on 2026-08-23. The
verdict reaches a free uptime monitor as an HTTP status, which is the same
shape the queue's liveness detector uses and for the same reason: a monitor
cannot send a header, and a detector nobody watches is the failure being fixed.

| Threshold | Metric | Reading | Window | Alerts at |
| --- | --- | --- | --- | --- |
| `submission_lost` | `survey_submission_lost_after_retries` | count | 360 min | 1 |
| `suggestions_failing` | `ai_question_suggestions_failed` | count | 360 min | 3 |
| `analysis_written_without_the_model` | `ai_deterministic_summary_ratio_sample` | mean over ≥2 samples | 1440 min | 0.5 |
| `contract_rejected` | `ai_contract_validation_failures` | count | 360 min | 1 |

Why these four:

- **A submission that never arrived.** The deployed endpoint loses the first
  submit after an idle period, and loses it *before* the function is invoked —
  the deployment's own logs hold no entry for the request that died. The only
  witness is the respondent's client, which had to send twice. One occurrence is
  the alert; there is no acceptable rate of losing a teacher's answers.
- **A paid model that stopped answering, read twice.** It surfaces in two
  unrelated places and either can be first. The suggestion button fails outright
  — a count. And an analysis *succeeds* while writing its own copy from the
  aggregates, because contract 6.0 never fails a dimension over a silent
  provider; that one looks perfectly healthy in `ai_jobs_succeeded`. This exact
  failure has happened once already, a depleted prepayment, and establishing it
  took four hand-made requests and a read of Render's log.
- **A payload the contract refused.** A defect on one side of the boundary or
  the other, whose healthy rate is zero.

Deliberately not alerted on: `ai_jobs_failed`, which the queue's stall detector
and this list already cover between them, and every duration and counter whose
interesting reading is a trend rather than a line.

The windows differ on purpose. Six hours for the counts is long enough to still
be alerting when someone opens the mail and short enough that a fixed problem
clears itself without anyone acknowledging it. Twenty-four hours for the ratio,
because a school closes a round every few weeks and a six-hour window would
almost always hold no sample at all. A mean below its minimum sample count
reports `null` rather than zero — one round writing its own copy is one round's
luck, and alerting on that teaches whoever reads these to ignore them.

## The two endpoints

| | `GET /api/health/observability` | `GET /api/observability` |
| --- | --- | --- |
| Who | any uptime monitor, anonymous | an operator, `AI_CALLBACK_SECRET` |
| Answers | `ok` 200, `alerting` 503, `unknown` 503 | every reading with its window and limit |
| Carries | a word and the breached threshold ids | counts, means, sample counts |
| Writes | the retention sweep, after the response | nothing |

The split is the queue's: the public half publishes a verdict a monitor can act
on, and the numbers stay behind the secret because a count of failed analyses
says how much measuring is happening and how badly it is going, even though it
names no school. Threshold ids *are* published anonymously — `submission_lost`
sends someone somewhere different than `contract_rejected`, and that is what
makes the monitor's mail actionable.

`unknown` is a `503` on purpose. A deployment recording nothing and a deployment
with nothing to record look identical from outside and mean opposite things.

## Retention

Rows older than the cutoff are swept on the way past the public endpoint. That
is the one thing this deployment is guaranteed to be called on a schedule, the
project owns no scheduler, and the sweep is a single indexed delete that runs
after the response and cannot change the verdict it just gave.

| Setting | Value | Source |
| --- | --- | --- |
| Retention | 30 days | `OPERATIONAL_EVENT_RETENTION_DAYS` |
| Count window | 360 min | `OBSERVABILITY_COUNT_WINDOW_MINUTES` |
| Ratio window | 1440 min | `OBSERVABILITY_RATIO_WINDOW_MINUTES` |

Thirty days answers the question these rows exist for — "did this start
happening, and when" — and stops well short of the table becoming a second copy
of the product's history. A cutoff rather than a per-name cap, because the
failure being watched for is a burst of one name, and a cap would discard
exactly that burst while keeping a quiet month of another.

## What this is not

It is not a metrics backend. There is no aggregation over time, no percentile,
no dashboard and no query language; reading a trend means reading rows. That is
deliberate for a design-stage product with no respondents: the store is a sink,
and pointing it at Sentry or an equivalent later is one function, not a
migration.

And it does not notify by itself. The `503` is the notification, and it only
reaches anyone once a monitor is pointed at the endpoint — see
[`shalomut-tracker-handoff.md`](shalomut-tracker-handoff.md) for whether that
has been done.
