# Shalomut Tracker — operational handoff

**2026-08-18, session close (second and final for the day): the repository now
says what it grants, and this paragraph went stale while it was being written.**
`origin/main` is **`ace5c3c`**, asked of the remote directly — and the first
draft of this sentence said `3b7b58c`, because `ace5c3c` reached the remote in
the minutes between writing it and committing it. Above the tip sits one local
commit on `docs/the-public-repository-grants-nothing`: the one carrying these
words. `ace5c3c` itself archived that branch's task file and moved the copyright
question into the open items below, where a question that still needs answering
can be found.

What landed after the close recorded beneath this one: `NOTICE` at the root,
a `Licence` section in `README.md`, `"license": "UNLICENSED"` in `package.json`
(`3b68b6e`), and `.mailmap` (`3b7b58c`). Between them they answer open decision 7
of the 2026-08-10 strategy sweep and take the appearance half of its risk 4 off
the table; the substance half is the copyright line, which is an owner question
and is recorded below.

**Every one of those reached `main` without an agent pushing anything.**
`3b68b6e` was found already on the remote while checking something else, and
`ace5c3c` arrived between two commands in the same session close. That is the
fourth, fifth and sixth observation of the same behaviour in this file, and the
sixth is the sharpest: a written claim about what is unpushed can be false
before it is committed. Ask the remote, as late as possible; never a tracking
ref, and never an assumption.

Verification: nothing has changed under `ai-analytics-service` or `src` since the
full Python suite ran at **513 passed in 5.72s** earlier in this session, so that
remains the standing evidence and no new run would prove anything. For the
documentation and metadata that did change: `git diff --check` clean, every
relative link in the touched files resolves, `package.json` parses and its one
new field is metadata no build step reads, `npm run lint:skills` passes — run
because two root-level files were added and that check sweeps the root for
undeclared entrypoints, which neither `NOTICE` nor `.mailmap` is. `.mailmap` was
verified by what it does not do as much as by what it does: `git shortlog -sne`
reports two identities where it reported four, `git check-mailmap` resolves both
old addresses and leaves `Claude` alone, and every commit hash is unchanged.

The worktree is clean apart from `next-env.d.ts`, modified before this session
and unrelated to it; `git ls-files -o --exclude-standard` returns nothing.
`docs/agent-tasks/active/` holds two files and neither belongs to this session:
`research--scientific-evidence-layer.md` and `claude--free-ai-service-deploy-yk4tjj.md`.

**Next concrete step:** hand over
`git push origin docs/the-public-repository-grants-nothing:main`. Documentation
only, so nothing rebuilds and nothing needs re-verifying after it. After that the
repository has no unfinished agent work; what remains is the owner's — the Gemini
prepaid balance, and the copyright line now published in `NOTICE`.

**2026-08-18, session close: three observability slices are on `main`, and the
push that carries this session's documentation was rejected once first.**
`origin/main` is **`6ae2f13`**, asked of the remote directly. It contains all
three code branches of this session's stack —
`feat/the-monitor-can-see-a-half-written-map` (`f360d17`),
`feat/one-line-says-what-a-round-costs` (`ec847ba`) and
`fix/the-unpaced-fixture-unpaces-both-tiers` (`a39ca09`) — and, above them, four
documentation commits from a concurrent session that landed while this one was
writing: `b67fcc3`, `45908d1`, `ee6da0b`, `6ae2f13`. The last of those adds
`GET /api/v1/fallback-status` to the endpoint surface table in
`docs/ai-analysis-run-lifecycle.md`, correctly leaves *which monitors exist* to
this file, and is the reason nothing here needs to restate it.

**The rejection was the ordinary one and is worth recording as such.** The push
was refused with `fetch first` because `main` had moved by four commits nobody
in this session pushed — the fourth observation in this file that work reaches
`main` here without an agent running `git push`. The branch was rebased onto
`6ae2f13` with `--autostash`; every commit replayed without a conflict, because
the two sessions touched disjoint files, and `next-env.d.ts` — modified before
this session and unrelated to it — came back untouched.

So the local branch `fix/the-unpaced-fixture-unpaces-both-tiers`, which still
has no ref on the remote at all, now sits seven commits above `6ae2f13`:
`cdc4393`, `39f6c80`, `764702a`, `e712fd1`, `fd4ad51`, `458f7fa`, and the one
carrying this paragraph. Every one of them changes only Markdown — this file and
the task files archived below. Nothing in them is code, so nothing in them can be
deployed, and Render's `buildFilter` will ignore the push when it happens. The
worktree is otherwise clean and `git ls-files -o --exclude-standard` returns
nothing.

The three task files for the landed branches moved to
`docs/agent-tasks/archive/`. `docs/agent-tasks/active/` now holds two files and
neither belongs to this branch: `research--scientific-evidence-layer.md` and
`claude--free-ai-service-deploy-yk4tjj.md`, the latter from the concurrent
session above.

Verification for this session, in full: `.venv/bin/python -m pytest` from
`ai-analytics-service` — **513 passed in 5.72s**, the whole suite the matrix
requires for that directory. No code has changed since that run, on this branch
or on the four commits merged under it. For the documentation itself,
`git diff --check` over `6ae2f13..HEAD` is clean and every relative link in the
touched files resolves. `npm run lint:skills` was not run and did not need to
be: no skill and no adapter was touched.

What stays open is the owner's, not an agent's — the Gemini prepaid balance,
which the entry below explains, and the standing monitor incident that clears
itself once credit is restored and five real conversations succeed.

That step — pushing the rebased branch — **was taken the same day and landed as
`d6d6b13`**. The session did not end there; it continued into the licensing
slice, and the entry above this one is the close that supersedes this paragraph.
What is worth keeping here is the pattern, not the instruction: a push refused
with `fetch first` means `main` moved, and the remedy is ask the remote, rebase,
push again.

**2026-08-18, latest: `main` is `d47a59c`, and the paragraph below it is what
happens when a tracking ref is trusted.** The remote was asked directly —
`git ls-remote origin refs/heads/main` — and it answers `d47a59c`, which is the
tip of the four documentation commits the 2026-08-17 close recorded as unpushed.
So nothing was waiting on a push; `refs/heads/feat/the-monitor-can-see-a-dead-model`
is still `273eda5` on the remote, which is how the branch looked when it was last
pushed under its own name. This is the third observation of the same thing in
this file: work reaches `main` here without an agent running `git push`, and the
only reliable way to know is to ask the remote.

**2026-08-18: the `429` is a depleted prepaid balance, and it will recur.** Read
in Google AI Studio's billing page in the owner's signed-in Chrome, read-only:
the credit balance is **negative**, and the page states the rule outright — *a
credit balance above $0 is required to resume service*. The last top-up was
₪50 on 2026-08-05 and it was consumed by 2026-08-17, which is the night the
provider watchdog first fired. **Auto-reload is Off**, so this is not an
incident so much as a cycle: the balance empties, the API answers `429`, and
whoever notices tops it up.

Rate limits rule themselves out as the cause. On the paid tier the peak of the
last 28 days for `gemini-3.5-flash` is `27/1K` requests per minute and
`160/10K` per day — two orders of magnitude below the ceiling. Nothing here was
throttled for asking too fast.

The owner decided, 2026-08-18, not to close the standing monitor incident: it
reports a true condition, and the fix is the balance. It clears on its own once
credit is restored and five real conversations succeed, because the window is
twenty wide.

Two things this changes for the repository. The cost question now has real data
on both ends — ₪50 spent over twelve days of development at one end, and the
per-answer token line shipped in `ec847ba` at the other — so "what does a round
cost" is answerable by arithmetic rather than by the 2026-08-10 estimate. And
`docs/product-strategy-axes-2026-08-10.md` asks, as its very first Tier 0
deliverable, that the paid-key question be recorded with its date; the answer
"paid, Tier 1, prepaid, auto-reload off" is the fuller version of the
2026-08-05 entry that said only that the key was paid.

**2026-08-18: the map's watchdog is proved end to end, in 46 seconds from
detection to inbox.** Monitor `803766551` is Down on incident
`348072543433159758`, root cause `Keyword has been found`, started 14:56:01
GMT+3. Its activity log is the whole chain and is worth copying here because
nothing in this repository can hold it: detected by Ashburn 14:55:16, confirmed
by N. Virginia 14:55:31, by Ohio 14:55:46 and by Dallas 14:56:01, **e-mail sent
to the owner 14:56:02, `SUCCESS`**. UptimeRobot also stored the body it read —
`{"status":"degraded"}` — so the alert carries its own evidence.

**It was provoked without a round and without a byte of data.** The window
counts provider conversations, not stones, so five `POST
/api/v1/questions/suggest` calls against the deployed service filled it: four
reached the provider and failed on `http_429`, joining the one from the earlier
probe, and `observed: 5, fellBack: 5, ratio: 1.0` crossed the line. A round was
the obvious way and the wrong one — `scripts/seed-local.ts` refuses any
non-loopback database on the grounds that a seeded round on the deployed
endpoint is a fake school on a real dashboard, and defeating that guard to
demonstrate a monitor is a poor trade. What this therefore does **not** show is
what the product does with a degraded round — whether a map publishes wholly
derived or the run fails outright. That still needs a school on the deployed
database, and it is a separate question.

One detail from the same run is worth keeping: the `workload` suggestion was
refused with `400` before reaching the provider, and it did not move the window.
Nothing was spoken to, so there was nothing to count — the same rule that keeps
a deliberately skipped green dimension from reading as a failure.

**The incident is honest and will stay open.** The provider really is refusing,
so a round run now really would produce a derived map. It clears when the quota
or credit is restored *and* real work succeeds enough times to push the failures
out of a twenty-wide window — or, as the provider watchdog demonstrated this
morning, when a restart empties it to `unknown`. The fix is the provider
account, not the monitor.

**2026-08-18: the provider is down, and it is `http_429` again.** Established by
probe rather than by inference. `/api/v1/provider-health` first confirmed the
process had observed nothing since starting at `11:22:49Z` — so the fifteen-hour
incident really was cleared by a restart and not by a recovery. One
`POST /api/v1/questions/suggest` against the deployed service then forced a real
conversation: `503`, `Question suggestion unavailable: http_429`, three attempts
on `gemini-3.5-flash`. **The provider account is the thing to fix**; `http_429`
is what a depleted prepayment produced on 2026-08-17 and nothing here
distinguishes that from an ordinary quota.

The probe re-armed the watchdog, which is worth recording as the second
end-to-end proof: `/api/v1/provider-status` moved to `failing` within seconds,
so monitor `803761399` finds the keyword on its next five-minute check.

**And the two words diverged for the first time, in the mild direction.**
`fallback-status` stayed `unknown` while `provider-status` said `failing`,
because the window holds one observation of the five it requires. That is the
designed behaviour and the reason the two are separate monitors: one failed
conversation is a dead model, not a half-written map, and only one of those is
worth an alert about the map. The map's monitor will have something to say the
first time a round runs against this provider — every dimension would fall back,
and the window would fill in one round.

**2026-08-18: the fallback monitor exists — `803766551`, and the agent created
it with the owner's explicit permission after two of the owner's own attempts
did not save.** Keyword monitor on
`https://shalomut-ai-analytics.onrender.com/api/v1/fallback-status`, keyword
`degraded`, mode **Start incident when keyword exists**, five-minute interval,
e-mail to the account address, case-insensitive. Verified on its own page: first
check completed 31 seconds after creation, `Up`, `0 incidents`, and the list
reads `Using 3 of 50 monitors` with all three green.

Two things about the creation are worth keeping, because they are how the
earlier attempts most likely failed. The form opens on **HTTP monitoring**, and
the keyword fields do not exist until the type is switched to *Keyword
monitoring* — a monitor saved without switching would be a plain HTTP check that
can never see the word. And the form re-lays itself out the moment a URL is
entered: a `Friendly name` line appears and pushes the keyword input down, so a
click aimed at where the field just was lands on the label instead and the
keyword silently stays empty. This happened once during this creation and was
caught only by reading the field back before saving.

The keyword literals are now a contract with two monitors rather than one.
`tests/test_provider_health.py` pins all six words; nothing in the repository
can pin the monitors.

**2026-08-18, read in the dashboard: the fallback monitor did not exist, and
the provider one spent fifteen hours Down.** The account holds two monitors —
`Using 2 of 50` — the keep-alive on `/health` and monitor `803761399` on
`/api/v1/provider-status`. There is no monitor on `/api/v1/fallback-status`;
whatever was created did not save, or was created somewhere this account cannot
see. The endpoint is live and still unwatched.

`803761399` itself is configured correctly — keyword `failing`, *presence*, five
minutes, the right URL — and its reading is the news. **One incident, started
2026-08-17 23:03:10 GMT+3, resolved 2026-08-18 14:02:14 GMT+3, duration 14h 59m
4s**, root cause `Keyword has been found`. That start time is the one this file
already records as the watchdog's first fire, and what it did not record is that
the incident never cleared: the model was failing all night and nobody looked.
Last 24 hours read `5.235%`.

**The resolution is not a recovery, and the endpoint says so.** A cleared
keyword means `failing` stopped appearing, which happens two ways: the provider
answered, or the process restarted and forgot. `/api/v1/provider-status` answers
`unknown` right now, and `unknown` is what a process that has observed nothing
says — so it restarted. Whether the model answers is therefore not known by
anyone; the next real provider call decides it, and re-arms the alert within
five minutes if the condition survived.

That is a cost of the design worth stating rather than a defect in it: the
reading is in-memory by choice, and `unknown` deliberately does not alert so
that silence never pages a human. The bill for those two decisions is that a
deploy silences a standing alert and closes its incident, and the dashboard then
reads as though the outage ended. The provider account is the thing to check —
the 2026-08-17 fire was a depleted prepayment, and nothing here has ruled out
its still being that.

**2026-08-18, deployed: `main` is `a39ca09`, the AI service runs it, and the
second watchdog answers.** The owner pushed the three-branch stack.
`refs/heads/main` is `a39ca09`, asked of the remote, and `/health` reports
`commit: a39ca09` — so repository and service agree. Read anonymously:
`/api/v1/fallback-status` → `{"status":"unknown"}`, `/api/v1/provider-status` →
`{"status":"unknown"}`, `/api/v1/provider-health` → `401`. That is the whole
contract holding on the deployed service: the new word is reachable without a
secret, it is `unknown` rather than a healthy word on a process that has
observed nothing, the two watchdogs answer from two bodies, and the ratio,
window and counts stay behind the secret. Core answered `status: ok` with
producer `6.0` on the same pass; nothing in this stack touches Core.

Two readings, ten minutes apart, disagreed — the first said `commit: ec847ba`
and the second `a39ca09` — because the build for the last commit was still
running. Worth knowing when checking a fresh push: a `commit` one behind the tip
can mean "still building" and not "Render missed it", and the way to tell them
apart is to read again before opening the dashboard.

**What remains is one form in a dashboard.** The UptimeRobot keyword monitor on
`degraded` does not exist yet; until it does, the reading is live and unwatched.

**A second watchdog is written and is not deployed.** `GET
/api/v1/fallback-status` on the AI service answers `writing`, `degraded` or
`unknown` over a bounded window of the last twenty provider conversations, and
`degraded` above half. It is the alert on the deterministic-fallback ratio that
`docs/product-strategy-axes-2026-08-10.md` asks for in Tier 0 §5 and Tier 1 §8,
and it answers the question the existing provider watchdog cannot: a round whose
last conversation succeeded reads `answering` while most of its map is
service-derived copy. It reads the same recording as the provider word rather
than a second hook, which is what keeps the `ONLY_LLM_FOR_PROBLEMATIC` green
skip — a dimension deliberately never asked — from counting as a failure.
Committed on `feat/the-monitor-can-see-a-half-written-map`; the endpoint exists
on the deployed service only after that reaches `main` and Render builds it, and
the monitor that reads it does not exist at all yet. Both are the owner's hands
and are listed as such below.

**2026-08-17: `main` was `273eda5` and the AI service ran it.** The three
observability branches were pushed by the owner and are on `main`; `/health`
answers `commit: 273eda5`, so the deployed service and `main` agree. The watchdog
for a dead model is live — monitor `803761399`, recorded in full below.

**Session close: three documentation commits sit on
`feat/the-monitor-can-see-a-dead-model` and are not pushed.** `0b238af` (the
monitor exists), `ceca453` (it fired) and `e4173a0` (the three task files move to
`archive/`), on top of `273eda5`. The branch has no upstream, and the remote was
asked: `refs/heads/main` is `273eda5`. So this handoff is portable to another
worktree, which can check the branch out, and **not** to another checkout or
machine until someone pushes. No code is in those commits — the deployed
behaviour is already whole without them. The only worktree modification is
`next-env.d.ts`, pre-existing and unrelated, left unstaged; `git ls-files -o
--exclude-standard` confirms nothing untracked.

**Render can miss a push, and it did — an auto-deploy is not a guarantee.** The
push landed on GitHub at 22:38 GMT+3 and Render queued nothing: its dashboard
carried a *GitHub Outage — deploys from GitHub repositories may be affected*
banner, and GitHub's own status API confirmed a Partial System Outage with
sporadic authentication failures, incident opened 19:13Z and still investigating.
The last auto-deploy was `4c06351` from the day before. `Manual Deploy → Deploy
latest commit` built `273eda5` normally (`dep-da1m9ougekts738b815g`, about four
minutes to answering). So when a push that touches `ai-analytics-service/**` does
not appear on the service, check the deploy list before rereading the diff —
`buildFilter` in `render.yaml` is the usual explanation, but a missed webhook is
the other one.

**2026-08-17, a later session: the deployed AI-service variable is no longer an
unknown, and nothing is waiting on a push.** `refs/heads/main` was `945ed46` at
the time,
asked of the remote itself, and it equals this worktree's HEAD — so everything
here is portable to another checkout or machine. All four workflows are green on
it — `Core verification` `32047052787`, `Browser smoke` `32047052709`,
`Vercel Deployment & Pipeline Checks` `32047052647` and
`CodeQL Security Analysis` `32047052667`.

**That push happened during the session without an agent running `git push`.**
Forty minutes earlier the same remote answered `f5798cb` for `refs/heads/main`
and had no branch by this one's name at all, so the commit reached `main`
directly rather than through its branch. This file's 2026-08-15 paragraph about
branches reaching `origin` here on their own is the current reading, and this is a
second observation of it — with the wrinkle that what moved was `main`. Ask the
remote rather than a tracking ref, and ask it again before calling anything
unpushed.

The AI-service variable reading is recorded below, beside the paragraph that
asked for it, rather than repeated here.

**2026-08-17, session close: the response-quality plan is finished and landed on
`main`.**

The five branches merged as one stack. B, C, D and the docs branch were already
linear from `main`, and A came in as a merge commit at the end; the single
expected conflict was `docs/shalomut-tracker-handoff.md`, where A and D each
replaced the same migration bullet, and
`src/app/api/survey/[shareCode]/submit/route.ts` merged itself correctly —
A's removal of the analytics enqueue and D's added field both survived, which
was checked by reading the merged handler rather than by trusting the merge.
`npm run verify:core` exits 0 on the merged tree at 1156 TypeScript tests.

Both migrations were applied to the deployed database **before** the push, since
both are additive; see the gate below for the read-back evidence.

The plan `docs/response-quality-plan-2026-08-17.md`, on
`research/how-a-round-was-filled`, is closed end to end. A moved AI analysis to
round closure. B computed how long a round took to fill. C put it on the round
screen. D replaced the session lifetime with the time the questionnaire was
actually visible in the respondent's browser. E is decided rather than built —
see below. Each branch's own task file holds its evidence, and all five were
archived to `docs/agent-tasks/archive/` on 2026-08-17 once they had landed;
`docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`. Nothing of that evidence is copied
here.

Three things outlive the plan and belong to whoever picks this up.

**The branches are a stack, in this order:**
`refactor/analysis-runs-when-a-round-closes` (`06c20d8`),
`feat/how-long-a-round-took-to-fill` (`01a0bc7`),
`feat/the-round-says-how-it-was-filled` (`a3080fa`),
`feat/how-long-the-questionnaire-was-in-front-of-them` (`c5963d2`, plus one
unpushed correction to its own task file) and
`docs/attention-checks-and-what-they-cannot-unblock`. A and B were independent;
C follows B; D follows C; this one follows D. The one known conflict is
`src/app/api/survey/[shareCode]/submit/route.ts` — A removes the analytics
enqueue from it and D adds a validated field to the same handler. The resolution
is mechanical and must not resurrect the enqueue.

**One consent sentence was drafted and is now approved — owner, 2026-08-17,
after it had already deployed.** The respondent screen now
states that the time the questionnaire was on screen is measured and stored with
the answers, and that no per-question timing is collected. The wording is the
owner's to approve before this reaches a real respondent, and the approval came
after the deploy rather than before it — no real respondent had read it in
between, because there are none, but the ordering is the thing to fix next time:
the gate was named on the branch and the branch was landed without checking it.
It is a promise, not copy: the "no per-question timing" half is a limit on what
is collected, so relaxing it later is a promise to re-negotiate rather than a
schema change.

**Exclusion is closed on grounds no methodologist answer can reopen.** The plan
said attention-check items would make it defensible later, because they are the
one careless-responding signal that is not directionally biased. ADR-022 closes
it on the number of published bases instead, which says nothing about how a
second basis was chosen — so an unbiased criterion leaks exactly as much. This
is recorded in `PROJECT_CONTEXT.md` ADR-022 and stated at the top of question 6
of the methodologist files, so that a positive answer cannot be read as
permission.

**2026-08-16, closing a later session: the questionnaire audit has nothing left
in it that an agent can act on, and what stops the rest is one person.**

`refs/heads/main` is `f60f442`, asked of the remote itself. **One commit is
waiting on a push**: the documentation commit carrying these paragraphs, which
is deliberately not written here as a hash — three entries below were caught by
exactly that, a commit that stated the tip and then became it. The load-bearing
pointer is the other one: **the last commit that changes product code is
`3fc32ec`**, the builder's answer scale, and it is on `main` already.

All four workflows are green on `f60f442` — `Core verification` `31956098063`,
`Browser smoke` `31956098095`, `Vercel Deployment & Pipeline Checks`
`31956098070` and `CodeQL Security Analysis` `31956098262` — and
`npm run verify` exits 0 on the same tree, `verify:db` included.

**Every finding of `docs/questionnaire-modularity-audit-2026-08-16.md` §3 is
now closed** — 1, 2, 3, 4 and 6 fixed, 5 withdrawn — and both recommendations of
its §6 are built: the distribution buckets through the shared scoring bands, and
the default is constructed once with the instrument id stamped into the round's
snapshot. The last loose end that document left, and the one this session took,
was the builder writing `wellbeing-colour` into the literal at every place a
question is born; it now reads the scale from the questionnaire in hand, and the
walk that proved it is in
`docs/agent-tasks/archive/fix--a-new-question-answers-on-the-questionnaires-scale.md`.

Three things are deliberately left, and none of them is an oversight:

- **The reporting half of scenario (c).** `scoreDistribution` still carries
  three colour keys for a Likert answer. That is a wire change, so it belongs to
  phase 5 and contract `7.0` — and to the methodologist's answer about where the
  bands sit once an answer is a Likert value.
- **Scenario (d), a different dimension set.** Not planned, and part of its cost
  is paid by phase 5 anyway. Next to it sits a thing worth not rediscovering:
  `AI_ANALYTICS_DIMENSION_IDS` is derived from the frozen v2 manifest and does
  reach live 6.0 prompts, which is harmless only because all six manifests are
  asserted to carry identical dimension ids.
- **`src/app/api/survey/[shareCode]/route.ts:68`**, which ships the global
  dimension list inside an otherwise snapshot-built payload. The audit left this
  one unresolved between agents. Read again this session: the parser refuses any
  question outside the eight, and no in-app consumer reaches that route, so it
  is wrong only under (d). Named here so nobody reports it as a new finding.

**What actually blocks the product is unchanged and is not engineering.** The
questions of `docs/methodologist-questions-2026-08-15-ru.md` and `-he.md`
have no answers yet — five of them at the time of this entry, six since
2026-08-17. Question 2 — the item-to-dimension mapping and the
reverse-scored list — is what stops phases 3, 5 and 6 of the research
instrument: its machinery exists and its content does not.

**2026-08-16, an earlier session that day: the branch gate changed meaning, and
it did so because it was letting a whole service through unchecked.**

`refs/heads/main` is `4c06351`, asked of the remote itself. Nothing is waiting on
a push. The session walked findings 2–5 of
`docs/questionnaire-modularity-audit-2026-08-16.md` §3 and closed each on its own
branch; the archived task files under `docs/agent-tasks/archive/` hold the
evidence, and this entry records only what outlives them.

**`npm run verify:core` now runs the Python suite.** It did not before, and
`.github/workflows/verify-core.yml` runs `verify:core` alone on every push — so
a regression on the Python side was green on every branch and only met a red X
on `main`, where `deploy-vercel.yml` runs `npm run verify` whole. This was not a
theory: with a real prompt defect fully reinstated, the entire old chain — eight
fitness checks, `typecheck`, `npm test`, `lint`, `build` — exited 0, while
`npm run verify:ai` on the same tree exited 1.

Two consequences worth knowing before the next session:

- **No CI file changed, and none needed to.** `verify-core.yml` already builds
  `ai-analytics-service/.venv`, because `npm test` drives the real Python
  pipeline through it. The gap was never an environment boundary.
- **`npm run verify` is now `verify:core && verify:db`.** `verify:ai` moved
  rather than being added twice, so the deploy workflow's coverage is unchanged.
  A developer without the virtualenv now fails the branch gate earlier and by
  name instead of at deploy time. The 2026-08-15 entry below still describes
  `verify:ai` as reached only through `npm run verify`; that sentence was true
  when written and is superseded here.

**One thing about the deployed environment is unknown and was not established.**
`src/lib/server/request-question-suggestion.ts` resolves the AI service from
`AI_SERVICE_URL` and falls back to `http://localhost:8000` when it is unset. If
Vercel does not carry that variable, every suggestion in the deployed
environment has been silently taking Core's template path and never reaching the
model at all. Nobody has checked. It changes nothing about the fix that landed
today, and it would change what anyone believes about the feature's behaviour in
the deployed environment. One dashboard read answers it.

**2026-08-17: that read happened, and the variable is there.** The project's
Environment Variables page was read in the owner's signed-in Chrome:
`AI_SERVICE_URL` exists for `Production and Preview`, added Jul 25, alongside
`DATABASE_URL`, `AI_SERVICE_TIMEOUT_MS`, `AI_WEBHOOK_SECRET`,
`AI_CALLBACK_SECRET`, `MCP_SHARED_SECRET`, `SESSION_SECRET`,
`MANAGER_ADMIN_PASSWORD`, `MANAGER_ORGANIZATION_ID` and
`AI_ANALYTICS_CONTRACT_VERSION`. Names only — every one is marked `Sensitive`
and no value was opened.

Two corrections the read forces on the paragraph above, and the second is the
one worth keeping:

- The variable's own doc comment already said it
  (`request-question-suggestion.ts:33-37`, "already set in both environments").
  The unknown was in this file, not in the code.
- **"Silently" was wrong, and it would have been wrong even with the variable
  missing.** A suggestion is labelled `ai` only when the AI service answers with
  `source: "llm"`; anything else makes
  `src/app/api/manager/question-suggestion/route.ts` answer `503`, and the
  builder then offers its template under the template's own label. So the cost of
  a missing variable was a button that never works, visible to the manager — not
  a template wearing the model's label. The fallback-never-wears-the-label rule
  held on this path all along.

**The functional reading happened the same day, and it found a live defect: the
question suggestion does not work in the deployed environment.** Signed in as the
manager, four same-origin `POST /api/manager/question-suggestion` calls for
`balance` all answered `503` with `reason: "upstream_error"` and
`upstreamStatus: 503`, at 4.6–4.8s each. No round was needed or created — that
route reads no repository — and the deployed database was counted empty
immediately before: 0 organizations, 0 rounds, 0 responses, 0 answers, 0 AI runs.

What that establishes, and it is more than the variable's presence:

- **Core reaches something over HTTP.** An unset variable resolves to
  `http://localhost:8000` and would fail the fetch, which the route reports as
  `unavailable`; an HTTP `503` means a real response came back.
- **The AI service itself is awake.** `GET /health` on
  `shalomut-ai-analytics.onrender.com` answered `200` in 0.19s and 0.58s,
  anonymously, while the suggestions were failing. So this is not the free
  plan's sleep, and not the cold start the keep-alive monitor exists for.
- **The manager sees an honest failure**, which is the label rule holding under
  a real fault rather than in a test: the Hebrew "not available right now" plus
  the template under the template's own label.

**The cause is the provider account, and it also answers the question item 1 of
`docs/product-strategy-axes-2026-08-10.md` has been holding open since
2026-08-10.** The `GEMINI_API_KEY` in `.env.deployed.local` was used for one
minimal completion against the same endpoint and both default models the service
resolves (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
`gemini-flash-latest` and `gemini-pro-latest`). Both answered **`429`
`RESOURCE_EXHAUSTED`** in 0.43s: *"Your prepayment credits are depleted."* So the
key is valid, is on a **prepaid** account rather than an unlimited paid one, and
that account has no credit left.

That closes the loop on the 503 and on its timing. `config.py:184-198` gives
three attempts with a 0.5–2.0s backoff plus 0.25s jitter, and three exhausted
attempts of 0.43s with two waits between them land in the 2.3–5.8s window — the
observed 4.6–4.8s sits inside it. The service is not misconfigured, `main.py`'s
`AI_WEBHOOK_SECRET` branch is not what fired, and no code change would fix this.

**The service's own log says the same thing, so this is read rather than
inferred.** The owner signed in to Render and `shalomut-ai-analytics`
(`srv-d9i8vhnavr4c73ad298g`, Docker, Frankfurt, free, Deployed) shows four
matched pairs for the four calls, at 07:54:00, :22, :31 and :40 on 2026-08-17:

```
INFO:shalomut-ai-service:[Question Suggestion] Requested for dimension: balance
WARNING:src.services.llm_provider:[LLM Service] outcome=provider_unavailable
  model=gemini-3.5-flash reason=http_429 attempts=3
  scope=question_suggestion dimension=balance
```

`reason=http_429` on the service's own key closes the coincidence question, and
`attempts=3` is the retry arithmetic above, observed rather than computed. Its
Environment page carries `GEMINI_API_KEY`, `AI_WEBHOOK_SECRET`,
`AI_CALLBACK_SECRET`, `AI_JOB_POLLING_ENABLED`, `LLM_MODEL_FAST`,
`LLM_MAX_REQUESTS_PER_MINUTE` and `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY` among
others — names only, every value masked and none opened.

**One correction to the paragraph above, and it is worth knowing before anyone
probes this again.** The deployed service does not call the model that
`config.py:147` defaults to: `LLM_MODEL_FAST` overrides it, and the log names
`gemini-3.5-flash`. The local probe used the config defaults
(`gemini-flash-latest`, `gemini-pro-latest`) and got the identical 429, because
the depletion is a property of the account rather than of a model. So the
conclusion stands and the model names in it do not — a probe that wants to
reproduce what the deployment actually does must read `LLM_MODEL_FAST` first.

**The trace gap this exposed is closed in code on
`feat/a-dead-model-leaves-a-trace`, and the sentence above about Core holding no
trace describes the tree before it.** Neither the route nor the transport wrote a
line, and `ai-operational-metrics.ts` had no name mentioning a suggestion, so the
failure existed only in the AI service's own log. The route now emits
`ai_question_suggestions_succeeded` or `ai_question_suggestions_failed`, the
latter labelled with the transport's `reason` and, when a service answered with
one, `upstreamStatus`. A malformed request emits nothing, so a caller defect
cannot inflate the one number that says whether the provider is alive. It is the
same `console.info` envelope as every other counter, which means the open
decision below — nobody collects those lines — now governs this one too. Countable
is not noticed, and that distinction is the whole of what this change buys.

**And the next time this question is asked it should cost one request, not a
session.** `feat/the-service-remembers-its-last-provider-answer` adds
`GET /api/v1/provider-health` to the AI service, behind the same inbound secret
as its POSTs: the last provider outcome with its reason and model, or an explicit
`unknown` when this process has observed nothing. **Owner decision, 2026-08-17**,
of three placements — anonymous on the service's `/health`, behind its secret, or
manager-gated in Core: take the secret, because whether the account behind the
key has credit is exactly the class of fact Core's `/api/health` deliberately
refuses to publish (`src/app/api/health/route.ts:22`). Second owner decision the
same day: passive rather than an active probe, so the handle never spends a
provider call.

**And a second UptimeRobot monitor watches that handle — owner decision,
2026-08-17, created the same evening.** Of four paths — an anonymous minimal
endpoint, a real log collector through platform drains, making only the manual
read cheap, or one more keyword monitor with an `Authorization` header — take the
monitor, because the mechanism is already chosen and working for `/health` and it
costs nothing and adds no party. Approved in the same breath, and bounded to it:
`AI_WEBHOOK_SECRET` may be pasted into that one monitor, by the owner. **That
approval was never spent** — the header turned out to be a paid feature, the
anonymous path replaced it, and no secret left this repository's two deployments.
It is recorded rather than deleted so nobody re-derives it as standing permission.

**Its keyword is `failing`, and the alert fires when that string is present.**
Not the absence of `answering`, which is the trap this shape has: `unknown` is
the honest state of a process that has just redeployed or that nobody has used,
so a monitor keyed on `answering` would go red on every quiet period. Keyed on
`failing`, both quiet states stay silent and only a real refusal pages anyone.
`provider_health.py`'s three `status` literals are therefore a contract with
something outside this repository, and a test on
`feat/the-monitor-can-see-a-dead-model` pins them — a rename would not break
anything visibly, it would just stop the monitor finding the word and leave it
reporting Up forever.

**That header turned out to be a paid feature, and the plan changed the same
day.** Read in UptimeRobot's own monitor form on 2026-08-17, signed in: `Request
headers` is marked *Available only in Solo, Team and Scale*, as are HTTP method,
request body and `Up HTTP status codes`. The free plan offers an anonymous `GET`
with a keyword, its direction (`Start incident when keyword exists`), case
sensitivity, a five-minute interval and e-mail alerts — and no authentication of
any kind. So the secret-gated reading is unreachable to any free monitor.

**Owner decision, 2026-08-17, of four: publish the status word anonymously**
rather than pay for the header, add a second monitoring service, or keep no
watchdog. `GET /api/v1/provider-status` answers exactly `{"status":"…"}` —
`answering`, `failing` or `unknown` — and nothing else. The reason, the model, the
counts and the timing stay on the secret-gated path, because they are what turns
"the model is down" into "the account has no credit"; `failing` alone does not
separate a depleted account from an outage or a revoked key. It is less than
`/health` already publishes anonymously (`env`, `privacyThreshold`, `commit`,
`jobPollingEnabled`).

It is its own path rather than a field on `/health` deliberately: the keep-alive
monitor keys on `"status":"online"` there, and two watchdogs sharing one body is
how a change made for one quietly breaks the other.

**The monitor exists: `803761399`, created 2026-08-17 at 22:46 GMT+3**, in the
owner's UptimeRobot account beside the keep-alive one. Keyword type, `GET
https://shalomut-ai-analytics.onrender.com/api/v1/provider-status`, keyword
`failing`, `Start incident when keyword exists`, five minutes, e-mail to the
owner, no header and no credential — which is the whole point of the anonymous
path. Case-sensitivity is off, which costs nothing: the body has room for one
word.

It was created only after the endpoint answered, deliberately — a monitor pointed
at a path that does not exist teaches its owner to ignore it.

**Its first reading is `unknown`, not `failing`, and that is correct.** The task
file had predicted `failing` because the provider account is depleted; that
prediction ignored the redeploy. The state lives in process memory, a deploy
restarts the process, and nothing has called the provider since. So the monitor
starts green — its own first check, at 22:47, reports `Up` — and it will only go
red once a real suggestion or a round's analysis is refused. This is the residual
limit below, seen in its first minute rather than argued about.

**The red path was then proved end to end, on the owner's say-so, and it works.**
One real question suggestion on the deployed Core at 23:00:45 answered `503
upstream_error` in 5.2s; `/api/v1/provider-status` moved to `{"status":"failing"}`
by 23:00:45. UptimeRobot found the word from Ohio at 23:02:39, confirmed it from
N. Virginia at 23:02:53 and Dallas at 23:03:10, opened incident
`347832752932025400` — *Root cause: Keyword has been found* — and its activity log
records `Email sent to Maksim Berenshteyn / SUCCESS` at 23:03:12. **Two minutes
and twenty-seven seconds from a refused model to an e-mail**, and the incident
page keeps the response body `{"status":"failing"}` as its own evidence. The
question that cost a whole session on 2026-08-17 now answers itself in under three
minutes, unasked.

**The monitor is red now and will stay red, which is correct.** The provider
account is still depleted, so nothing will make the status `answering` again until
it is topped up. Do not resolve the incident by hand and do not read a green
monitor after a redeploy as recovery: the state lives in process memory, a restart
resets it to `unknown`, and `unknown` is silent by design. Green after a deploy
means nobody has asked the model yet — it does not mean the model answered.

**What this still does not do, and it is the honest half: it watches a provider
that fails in use, not one that fails while unused.** The state only moves when a
suggestion or a round's analysis actually calls the provider, so on a deployment
nobody is touching, a dead provider reads `unknown` and the monitor stays quiet.

**The metric lines are still uncollected.** This closes the provider half of that
open decision and no more: `ai_question_suggestions_failed`,
`survey_submission_lost_after_retries` and every other counter still land in a
`console.info` line that expires with the platform's log window. The collector
question below stays open.

The reading nobody has taken yet, and the one worth taking first once this is
deployed: one `curl` with `Authorization: Bearer <AI_WEBHOOK_SECRET>` against
that path. Against the current account it should answer `failing` with
`reason: "http_429"` after any suggestion attempt. `unknown` there would mean the
instance restarted and nothing has used the provider since — not that anything is
well.

Incidental, from the same log and not a defect: the run-claim poller posts to
`/api/ai-analysis-runs/claim/` every 2–3 seconds and answers `204` each time
against the empty database, while the keep-alive monitor takes `/health` about
every 5 seconds. Both are alive, which is the first direct sighting of either.

**What this costs the product while it stands.** It is not only the suggestion
button: the round pipeline reaches the provider through the same transport, so no
model-written prose is obtainable in the deployed environment at all. How each
call site degrades is *not* uniform and should not be guessed from this entry —
`llm_provider.py:373` returns a deterministic summary where
`llm_provider.py:300` and `:597` raise, so some scopes substitute derived copy and
others report having no answer. Nothing is mislabelled either way, which is the
fallback rule working. The load-bearing consequence is narrower and certain:
nobody should read the deployed environment as exercising the model until the
account has credit.

Two consequences worth keeping whatever the log says. The round pipeline is a
different path with its own fallbacks, so this reading says nothing about
contract `6.0` analysis; and nothing has ever exercised the suggestion button on
the deployed endpoint before today, which is why a feature could be dead there
across every session that called it "deployed as code".

**2026-08-15, closing that session: the blocker that has stood since 2026-08-14
now has something to send.**

`refs/heads/main` is `3f93bc5`, asked of the remote itself. **One commit is
waiting on a push**: `21f25dc` on `feat/a-lost-submit-leaves-a-trace`,
documentation only. Everything else in this file is on `main`. All four
workflows are green on `3f93bc5` — `Core verification` `31890754582`,
`Browser smoke` `31890754644`, `Vercel Deployment & Pipeline Checks`
`31890754567` and `CodeQL Security Analysis` `31890754561`. Nothing has run on
`21f25dc`, which has not reached the remote.

The two blocked items this file records — backlog §12 phases 3, 5 and 6, and
the evidence-layer decisions — are blocked on the same person, and nothing had
ever been written down to send them. `docs/methodologist-questions-2026-08-15-ru.md`
and `-he.md` are that, in both languages an answer might come back in: five
questions in plain language, each stating what a sufficient answer looks like.
What the eight dimensions rest on; the item-to-dimension mapping and the
reverse-scored list; where the bands belong once an answer is a Likert value
rather than one of three colours; whether the two allocation grids are scored;
and who is accountable for the intervention catalog. The first question names
"it came from practice, not from a publication" as a legitimate answer, because
the point is that the answer be recorded rather than that it be academic.

**One claim was corrected while writing them, and it corrects this file's
sources rather than this file.** `docs/scientific-evidence-layer-research-2026-08-09.md`
§1.7 reads as though no attribution reaches the manager. It does:
`dashboard-goals-panel.tsx:136` has printed `מבוסס על:` beside every current
recommendation since `257bb2f` on 2026-08-11, and all 192 catalog entries carry
a source. The study is a snapshot of `14c2269` and this is exactly the drift its
own residual-risk note warns about. What the catalog actually cites is narrower
than "evidence": ISO 45003 clauses and OECD/TALIS material, with 48 of the 192
sharing the most generic label of them all. So the open question is not whether
attribution exists but whether a clause of a standard, which attests that a risk
category is recognised rather than that an action works, is the level of
grounding this product should stand on. The questions document asks it that way.

The recommendation deliberately *not* acted on: the agent's answer to the
evidence layer stays what the research task file records — alternative A first,
no retrieval node, because a retrieval stage has nothing to bind to while the
catalog carries no structured evidence fields.

**2026-08-15, a later session: the lost submit is countable now, and it has
landed.**

`refs/heads/main` is `b8c23e1`, read from the remote itself. The owner pushed
`feat/a-lost-submit-leaves-a-trace` — `ee564e9`, `f18bfeb` and the
documentation commit — and it carried `9f617f3` across with it, the previous
session's closing commit, which had never reached the remote despite that
commit's own text saying nothing was waiting. Third time this file has been
caught by that shape; the correction is left above as written rather than
tidied away. **Nothing is waiting on a push now.**

The branch answers the standing consequence recorded below, that the retry
hides the symptom and nobody will see the next lost submit. The client reports,
after the outcome is already decided, how many attempts the delivery took;
`POST /api/survey/{shareCode}/delivery` turns that into one operational metric
line, `survey_submission_recovered_by_retry` or
`survey_submission_lost_after_retries`. Only the anomaly is reported — a
submission delivered first time is already counted as a stored response — and
the route reads no repository, because correlating a round would mean a
database lookup on the path of a report about the database being unreachable.

Verified locally: `verify:core` exit 0 with 1044 tests, `npm run test:e2e` 19
passed (18 before), the new browser spec falsified by removing the client call,
and the metric lines read off a production build's own output rather than
inferred. Details in
`docs/agent-tasks/archive/feat--a-lost-submit-leaves-a-trace.md`.

**What this does not do**, and it is the honest half: the counter has never
counted the real defect. That failure only happens on the deployed endpoint
after an idle period, and the browser test reproduces its shape, not its cause.
The first real reading is the first lost submit there. Where these lines land
afterwards is still the open owner decision recorded further down — the product
logs structured observability and nothing collects it.

**All four workflows are green on `b8c23e1`** — `Core verification`
`31890464509`, `Browser smoke` `31890464506`, `Vercel Deployment & Pipeline
Checks` `31890464458` and `CodeQL Security Analysis` `31890464394`.

**The deployment carries it, and for once that is readable anonymously.** A new
route is a far better deployment probe than this file's CSS-hash trick, which
cannot separate a server-only change from any other build:
`POST /api/survey/X/delivery` answers `204` on the endpoint while
`POST /api/survey/X/no-such-beacon` answers `404`, twice each. The route exists
there, so the counter is live.

**Three of the lines in the deployed counter are synthetic, and nobody should
read them as evidence.** Those probes emitted one
`survey_submission_recovered_by_retry` at `attempts: 2` and two
`survey_submission_lost_after_retries` at `attempts: 3`, from `curl` and not
from a respondent. The first genuine reading is the first one after 2026-08-15
that nobody typed.

**One thing worth recording from the probing itself.** The first
`POST .../no-such-beacon` returned `000` from `curl` — nothing at all — and the
two retries answered `404` in under 0.4s. That is the same shape as the defect
this whole line of work is about, on a route that reaches no database and no
handler, which fits the cold-path reading rather than the Postgres one. One
sample, so it is an observation and not a finding.

`docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions and not
on an agent.

**2026-08-15, closing that session: the lost submit is mitigated, and the
deployment's geography is now a known and deliberately accepted cost.**

The tip is the documentation commit carrying these paragraphs, so it is not
written as a hash here — that trap has caught this file twice. **The load-bearing
pointer is `ececa34`, the last commit that changed product code**: the submit
retry. `9c32ef2` before it and everything after touch documentation only.

**Nothing is waiting on a push**, asked of the remote itself rather than of a
local tracking ref, and the worktree is clean — confirmed with
`git ls-files -o --exclude-standard` as well as `git status`, because the
untracked cache has hidden a file here before. All four workflows are green on
`9c2dde5`, which carries the retry, and all four again on the tip.

The defect is **not fixed at its cause and was never going to be here**: the
owner read the deployment's function logs and there is **no invocation** for
either failed request, so it dies before any code in this repository runs. What
landed is a mitigation — `src/lib/survey-submission-retry.ts`, three attempts
1s and 3s apart, retrying only a *thrown* send, with the button reading
`מנסה שוב...` while it waits. It is safe in both directions because
`ALREADY_SUBMITTED` already resolves to a completion and the client already
sends the token that makes a second write refusable. Walked in a browser in all
three outcomes, including the one where every attempt fails: the old message
returns, the draft survives, and nothing is written.

**The standing consequence, and it is the reason this paragraph is here:** the
retry hides the symptom. The next time the endpoint loses a submit, nobody will
see it. If it matters whether this is rare or common, someone has to look for it
deliberately rather than wait to be told.

**The deployment runs in three places at once.** `X-Vercel-Id` reads
`fra1::iad1::…`, so functions execute in **Washington**; the database is
`aws-1-ap-northeast-2`, **Seoul**; `render.yaml:19` puts the AI service in
**Frankfurt**. The users are in Israel. Measured: **one database query costs
~180ms** — medians of ten samples, 0.307s for a route touching no repository
against 0.486s for one making a single lookup, with the same leg to the edge in
both. A submit makes several in sequence, which is where its ~2s comes from.

**Owner decision, 2026-08-15: change nothing for now.** Recorded with what it
accepts, in
`docs/agent-tasks/archive/fix--the-first-submit-after-idle.md`. The one piece
that is time-sensitive: the deployed database is empty, so moving its region
today is a new project and a new `DATABASE_URL`. After the first pilot school
answers, the same decision becomes a migration of real answers. The cheap window
closes with that school, not with a date.

`docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions and not
on an agent.

**2026-08-15, a later session: the research-instrument stack has now run on the
deployed endpoint, and it found one defect.** Branch
`test/deployed-walk-of-the-research-stack`, one commit `186d13d`. Everything
below about that stack being "deployed as code and nothing more" is superseded
for the respondent path, the breakdown screen and the builder; it still holds
for contract `6.0` at runtime, which this walk deliberately did not exercise.

What is now read rather than inferred. A respondent answered all fourteen steps
there by hand, and the stored answers came back `4→75` and `1→0` on the positive
1–5 block, `7→0` and `1→100` on the **negative** 1–7 one, with
`background_tenure`, `background_hours` and three allocation rows carrying
`dimension_id: null` and `score: null` — so the phase 1 migration is working
there, not merely applied. The two skipped questions are absent from the
response rather than stored blank. Signed in, `/breakdown` was read in five
states, including the two the privacy work exists for: a table that publishes
with a small group suppressed **and the unanswered column taken with it**, and a
table refused whole because publishing the large group would state the
remainder's scores by subtraction. The same round's other background question
still reads, so the refusal is per table.

**The defect, and it is on the one action the product exists for.** The first
`POST /api/survey/<code>/submit` after an idle period returns nothing at all —
`net::ERR_EMPTY_RESPONSE` in the browser, `status:000` after 12.8s from `curl` —
and the respondent is told `לא ניתן להתחבר לשרת`. Pressing send again works, and
the failed attempt writes nothing, so nothing is lost or duplicated. Five warm
requests afterwards answered in 1.8–3.0s. `trailingSlash: true` forcing a 308 on
this POST was checked and **ruled out**: control POSTs followed the redirect
correctly and `curl -L` carried the body through it to a 400 in 0.96s. What fits
is that the request which has to open a database connection is the one that
dies, and only when it is the first for a while. Nobody has read the
deployment's own function logs yet; that needs the owner's dashboard and is the
next step. Details in
`docs/agent-tasks/active/test--deployed-walk-of-the-research-stack.md`.

**The deployed database is empty again** — 0 organizations, 0 rounds, 0
responses, 0 answers, 0 AI runs, counted after
`scripts/clear-test-data.ts --confirm` deleted the throwaway school by id. The
walk's data existed for about forty minutes and is gone.

`scripts/seed-breakdown-round.ts` now takes `--allow-remote`. The loopback
default stays; the flag exists for a deployed smoke walk and says so.

**Both branches landed the same day.** `origin/main` is `c4baae9`, read from the
remote: the walk's two commits and the defect branch's one went across as one
fast-forward. All four workflows are green on `c6d3efa` — `Core verification`
`31886254260`, `CodeQL Security Analysis` `31886254250`, `Browser smoke`
`31886254419` and `Vercel Deployment & Pipeline Checks` `31886254292` — and four
more were still running on `c4baae9` when this was written.

The walk's task file is archived. `docs/agent-tasks/active/` holds **two**
files: `research--scientific-evidence-layer.md`, which waits on owner decisions,
and `fix--the-first-submit-after-idle.md`, which waits on the deployment's
function logs. Every sentence below saying the directory holds one file was true
when it was written.

**The defect's investigation has already killed two hypotheses, and the second
one matters.** The trailing-slash 308 is not the cause, and neither is the
database: `GET /api/health/` touches no repository and answered in 0.27–0.39s
across eight consecutive samples, but **once took 11.2s**. A route that only
returns JSON is not slow because of Postgres, so the ten seconds that kill the
submit are something else — a cold start against the function's time budget, a
`pg.Pool` created with no `connectionTimeoutMillis`, or a platform-side drop.
One thing worth knowing either way: the connection string points at
`aws-1-ap-northeast-2` — Seoul — and there is no `vercel.json` and no region
setting, so unless the project defaults to Seoul every query crosses an ocean.
That is a candidate for the ~2s warm submit even if it is not what kills the
cold one.

Updated: 2026-08-15, end of session. The tip of `main` is the documentation
commit carrying these paragraphs — deliberately not written as a hash, because
twice in a row a commit set that number and then became the tip itself, naming
the commit before it. The load-bearing pointer is the other one: **the last
commit that changed product code is `7ba34ac`**, the breakdown suppression rule,
with `beb2200` and `121ae2d` after it touching only documentation and the IDE
module file. Re-read both with

```bash
git log --oneline origin/main -- src/ next.config.ts scripts/ playwright.config.ts
```

`origin/main` rather than `main`: `main` is checked out in another worktree
here, so the local ref goes stale and this command answered `45e1340` — a
2026-08-13 commit — for a whole session after the stack had landed.

**Session closed 2026-08-15, later that day. Nothing is waiting on a push**:
`refs/heads/main` is `121ae2d`, asked of the remote itself rather than of a
local tracking ref, and it equals the working checkout's HEAD. Everything below
is portable to another checkout or machine. The worktree is clean, confirmed
with `git ls-files -o --exclude-standard` as well as `git status`, because the
untracked cache has hidden a new file here before. Eight workflow runs are
green across the session's last two commits — all four on `beb2200` and all
four on `121ae2d`. `docs/agent-tasks/active/` holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions and not
on an agent.

**2026-08-15, a later session: the cross-table privacy question is answered,
built and landed.** `privacy/suppression-holds-across-tables` went across as a
fast-forward the same day; `origin/main` was `b23ae58` and the privacy work
landed at `2a8f613`, read from the remote. The commit that changes product code
is `7ba34ac`, with documentation commits after it. All four workflows are green
on `2a8f613`:
`Core verification` `31882668272`, `CodeQL Security Analysis` `31882668183`,
`Browser smoke` `31882668185` and `Vercel Deployment & Pipeline Checks`
`31882668193`.

Owner decision that day: of the three answers to "the module defends
one table and the screen publishes several", take joint suppression rather than
restricting the screen to one table per round or accepting the limit with a
note.

What it turned out to be is sharper than the cross-table framing. The old rule —
no line of a table publishes exactly one blank — was satisfied by two blanks over
one person and nobody, and `/breakdown` prints each group's dimension averages
beside its size, so `veteran 40` against a round of 41 stated the forty-first
respondent's eight scores by subtraction. Reproduced on the unmodified module
before anything changed. The invariant now carries a second rule as well: the
blanks on a published line account for nothing at all, or for at least
`threshold` people. That is the rule that composes across tables without either
table knowing the other exists, which is what the owner's decision needed.

Verified locally — `verify:core` exit 0 twice with 1113 tests, and four states
walked signed-in against a production build: the new refusal, the same round's
role table still reading, the ordinary round unchanged, and the locked round
keeping its own message. Nothing crosses the AI boundary and no schema changed.
Details in
`docs/agent-tasks/archive/privacy--suppression-holds-across-tables.md`.

**The deployed side, read after the merge.** Two of the three questions have
answers and the third does not:

- **The endpoint is up.** `/api/health/` returns 200 with contract `6.0`,
  `producedContractVersionSource: "configured"`, and `/login/` answers 200.
- **The deployed database is still empty** — 0 organizations, 0 rounds, 0
  responses, 0 answers, counted directly on 2026-08-15 rather than carried
  forward from the earlier entry. So nothing there exercises this code: no round
  exists to break down, and the rule that changed cannot fire.
- **The served commit is `2a8f613`, read from the Vercel dashboard.** The
  deployment is Ready, `Environment: Production — Current`, built from `main` in
  41s, and `shalomut-map-demo.vercel.app` is among its domains. Its Git Commit
  link carries the full hash
  `2a8f613c11a95b6c73acb0a885c1af267ebb8915`, which is exactly what
  `git ls-remote` returns for `refs/heads/main`. So the endpoint carries
  `7ba34ac`, the privacy fix. The dashboard was read while `main` was
  `2a8f613`; two commits have landed since and Vercel will have redeployed, but
  neither changes product code, so the reading still holds for everything that
  matters.

Two notes for whoever reads this next.

**The CSS trick has stopped being able to answer this question.** `cmp` against
a local build still passes — `3i8jb3r94-7yz.css`, 116 583 bytes, byte-identical
— but it says "a build of this tree" exactly as it did before this change and
separates nothing, because the change touches no CSS and no client chunk. What
it touches is a privacy module and one Hebrew string rendered by a server
component behind `/login`, which no anonymous request reaches. Any future
deployment reading of a server-only change needs the dashboard, not `curl`.

**The project overview card says "No Production Deployment", and it is wrong.**
The project's own Deployments page shows this one badged `Production` and
`Current`. Do not take the overview card as evidence that nothing is deployed.

The endpoint being current matters less than usual here: with an empty database
it would look identical whether or not it carried the fix. What the reading
buys is that the next round created there gets the new rule.

What it leaves is a caution rather than a task: the rule suppresses strictly
more than before, so a small school with one dominant category now reads a table
that says nothing where it used to say something. Intended, and worth knowing
before it is read as a regression.

`docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions rather
than on an agent.

**2026-08-14, phase 4 gave the builder the second kind of question.** Branch
`claude/builder-for-background-questions`, also **unpushed**. A manager can now
write a demographic, numeric or allocation question, set an analysed question's
scale and scoring direction, and read a long questionnaire as collapsible
sections. It also fixed two defects the browser walk found — the larger one
outside the builder: `PrismaRoundRepository` handed back the raw JSON column
typed as a `SurveyDefinition`, so a questionnaire written before `kind` existed
reached the builder with no `kind` on any question and reported all eight
dimensions missing above twenty-four questions. Every server-side consumer
parses, which is why nothing had noticed.

Phases 1, 2 and 4 are done. **Phases 3 and 5 remain blocked on the
methodologist's mapping table**, and phase 6 is the swap itself.

**2026-08-15: that push has landed, and a fifth branch sits on top of it.**
Verified against the remote itself, not against local tracking refs:
`claude/default-research-instrument-plan` (`eeb8a82`),
`claude/answer-model-for-research-instrument` (`4e71bd8`),
`claude/k-anonymity-for-demographics` (`a2a42df`),
`claude/builder-for-background-questions` (`8b2e95c`) and
`claude/suppression-file-is-text` (`d3abeb5`) are all on `origin`. So the work
is now portable to another checkout or machine.

**2026-08-15, later: a sixth branch, and it is the one that puts the privacy
rule into service.** `claude/breakdown-by-background-question` sits on top of
the stack — three commits, `aa0e2db`, `1aabeb4` and a documentation commit. It adds `/breakdown`, a seventh navigation item between
the map and the goals: the eight dimension scores split by the categories of one
background question, with every group below the privacy threshold suppressed and
a second group taken with it whenever one alone would be recoverable by
subtraction. Verified locally — `verify:core` exit 0 with 994 tests, and all
three states walked signed-in against a production build, with the suppression
observed working rather than inferred. Nothing crosses the AI boundary, no
schema changed, and the deployed endpoint knows nothing about it.

One thing it leaves open, recorded in its task file. Its
`suppressCrossTab`/`suppressFrequency` guarantee holds **within one published
table**, and the screen now offers several tables for the same round — whether
that is acceptable is an owner decision that should be made before a real school
uses it.

**2026-08-15, later still: a seventh branch, and the second of those two open
things is closed.** `claude/respondent-answers-background-questions` sits on top
of the sixth — two commits, `6be8395` and `f6e4d69`. The
questionnaire screen used to render three colour stones for every question
whatever its kind; it now walks *steps* rather than questions and picks a widget
per question, so a respondent meets a single-choice question as a list of its
own options with a way to decline, a numeric question as a number field, and an
allocation grid as one screen of rows with a running total that must reach 100.

Verified locally — `verify:core` exit 0, zero test failures, and the whole
respondent path walked against a production build. **A background answer now
exists that a person produced by answering**: the walk's stored response holds
`background_tenure`, `background_hours` and three allocation rows, with the one
question that was skipped absent rather than blank. That is the residual risk
from the sixth branch closed, and it is the last thing the breakdown screen was
waiting on. No schema changed and the deployed endpoint knows nothing about it.

**2026-08-15, an eighth branch: the analytic half of phase 3.**
`claude/likert-blocks-for-respondent` is three commits — `7dfffa0`, `6a22539`
and a documentation commit. A block of statements sharing a section
and a scale is now one screen with its anchors stated once at the top, which is
the difference between 108 screens and 13. The time estimate stopped being a
question count and became a cost per step, so the twenty-four that are running
still quote four minutes while the 126-item instrument quotes 23 — inside the
20–30 the owner read the source document as.

It also produced the first mixed-polarity answer anyone has given by answering:
the walk's stored response scores `7→0` on a negative-polarity 1–7 block and
`4→75` on a positive 1–5 one. `verify:core` exit 0, and the block layout was
walked at 900px, 400px and 320px with no horizontal overflow and a target above
the WCAG 2.2 AA floor at the narrowest.

**What phase 3 still leaves is not code.** Owner decision 3 — which of the eight
dimensions each of the 108 items belongs to, and which are reverse-scored — is
still outstanding, so the instrument's machinery exists and its content does
not. The consent, intro and anonymity copy from the source document is also
still open: that document is not readable from the agent's environment.

**All eight branches are on `origin`, and none of them is merged.** Read from
the remote itself on 2026-08-15, not from local tracking refs:
`claude/default-research-instrument-plan` `eeb8a82`,
`claude/answer-model-for-research-instrument` `4e71bd8`,
`claude/k-anonymity-for-demographics` `a2a42df`,
`claude/builder-for-background-questions` `8b2e95c`,
`claude/suppression-file-is-text` `56fb284`,
`claude/breakdown-by-background-question` `20b0ac7`,
`claude/respondent-answers-background-questions` `408386f` and
`claude/likert-blocks-for-respondent` `5575177`. So the work is portable to
another checkout or machine, and the only thing still owed is the merge.

Three earlier entries in this file called branches of this stack "unpushed" and
left `git push` as the outstanding action. That was wrong about this
environment: a branch reaches `origin` here without an agent running `git push`,
which was confirmed by asking the remote about a branch created minutes earlier
and never pushed by hand. The dated entries above 2026-08-15 are left as they
were written; this paragraph is the current reading.

**The stack landed on `main` on 2026-08-15.** `origin/main` was `05a23bc` and is
`25ee069`, read from the remote: the whole research-instrument stack went across
as one fast-forward of twenty-six commits, so every branch tip above is now an
ancestor of `main`. The owner ran the push; the agent's `git push` was declined
by the permission layer as it always is here.

**2026-08-15, later: the deployment is serving that stack, and the two
deployed-side gaps are closed.** The paragraph that stood here said the
deployment was unverified and the migration missing; both were checked, and the
current reading is:

- **Deployed code.** `/login/` links
  `/_next/static/chunks/3i8jb3r94-7yz.css`, and that file is **byte-identical**
  to what a local production build of `4c25cf4` produces — same content hash,
  same 116 583 bytes, `cmp` clean — carrying the eight `.survey-block*` rules
  the Likert-block branch added. So the endpoint is running the merged stack.
  The dashboard's `gitSource.sha` was not read: it needs the owner's signed-in
  Chrome, and this reading answers the same question anonymously. It cannot
  separate `5575177` from `0b3e0af` or `25ee069`, which are documentation-only
  and build the same bytes.
- **The phase 1 migration is applied to the deployed database.**
  `20260814120000_answers_may_have_no_dimension_or_score` was the single pending
  one; `prisma migrate deploy` applied it and `migrate status` now reads
  `Database schema is up to date!` at thirteen migrations. Read back from
  `information_schema`: `question_answers.dimension_id` and `.score` are both
  nullable there. A deployed round can now store a background answer.
- **The backfill is a no-op there, which is weaker than having run.**
  `scripts/backfill-round-definitions.ts` reports every round carrying a
  snapshot, and the deployed database holds **0 organizations, 0 rounds, 0
  responses, 0 answers** — so the sentence is vacuous rather than earned. It
  must be re-run before the `surveyInstrument.questions` fallback is removed,
  because any round created there in the meantime is exactly what it exists for.

Every claim elsewhere in this file about a 24-question default, a three-colour
answer scale or contract `6.0` still describes the running product: nothing in
this stack changes what a respondent is asked until the instrument's own content
exists, and that waits on owner decision 3.

**All eight task files of the stack are archived.** Each branch is fully
contained in `origin/main`, checked branch by branch rather than assumed, so
`docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions and not
on an agent.

**The merge turned the browser smoke red, and `main` is green again at
`ca1472d`.** `Vercel Deployment & Pipeline Checks` failed twice — on `25ee069`
and `a8c8b81` — in the Playwright step only: the progress line reads
`שלב N מתוך M` since the flow started walking steps, and
`e2e/respondent-answers.spec.ts` still waited for `שאלה N מתוך M`. A stale test,
no product defect, and no deployment was blocked — `Deploy to Production
(Manual)` is gated on `workflow_dispatch` and Vercel's own Git integration
deploys regardless, which is why the endpoint stayed up throughout. Fixed by
`fix/the-progress-line-counts-steps` (`ca1472d`); all three workflows are green
on it, with 18 browser tests passed.

**The gap it exposed is closed: the smoke runs on every branch.** Owner
decision, 2026-08-15 — of the two answers, move the smoke rather than route
landings through pull requests. `.github/workflows/browser-smoke.yml` triggers
on `push` with no branch filter, exactly as `verify-core.yml` does, and carries
its own Postgres service, its own build and its own Chromium. The steps left
`deploy-vercel.yml`, so `main` does not pay for them twice, and that workflow
keeps `npm run verify` — `verify:db` and `verify:ai` included — and the mutation
dry run.

One consequence is deliberate and is written into the workflow: the manual
deployment job no longer waits on a browser. It waits on `npm run verify` and
the mutation dry run, while the smoke's own red X arrives at the same commit on
its own workflow. Two workflows now run on every branch — core verification and
browser smoke.

That sentence said "three ... and CodeQL" until 2026-08-15, and it was wrong
when it was written. `codeql.yml` triggers on `push` and `pull_request` with
`branches: ["main"]` on both, so it does not reach a branch at all; it was read
off the four green checks on a `main` push, where it does run. Corrected against
the workflow files and against a branch push that started exactly two runs.

Read back at `4ad5977`: four green runs, `Browser smoke` `31880134622` 2m26s
with 18 tests passed, and the deploy job down to 2m34s with no browser step in
it, checked step by step. What that did **not** show is the smoke on a branch:
the push went to `main`.

**That reading exists now, and it is green.** The push of
`privacy/suppression-holds-across-tables` on 2026-08-15 started exactly two
runs on the branch, both on `188379c`: `Core verification` succeeded, and
`Browser smoke` `31882333048` succeeded in 2m17s with 18 tests passed in 39.1s,
every step green and the report-keeping step skipped as it is on a pass. So a
branch now meets Playwright before it lands, which is the whole point of the
move, and it is a reading rather than an inference from the trigger.

**2026-08-14, later the same day, built the first two phases of it.** Phase 1
(`claude/answer-model-for-research-instrument`) made a question carry its own
scale and polarity, split questions into analytic and background, and made
`question_answers.dimension_id` and `.score` nullable so a demographic answer
can be stored beside a scored one. Phase 2
(`claude/k-anonymity-for-demographics`) added `src/lib/privacy/cell-suppression.ts`
and amended ADR-004 and ADR-005. Both branches are **unpushed** and need
`git push`; phase 1 also leaves a backfill script that has run against the
local database and not the deployed one.

Neither phase changes anything a respondent or a manager sees. The default
questionnaire is still the canonical 24 and the contract is still `6.0`; what
changed is what the model is *able* to hold.

**2026-08-14 opened a product outcome and wrote no product code.** Owner
decision: the default questionnaire becomes a 126-item research instrument —
mixed-polarity 1–5 and 1–7 scales, 18 items that belong to no wellbeing
dimension, and k-anonymous cross-tabulation by demographic group. The six phases
and the five still-open questions are in
`docs/default-research-instrument-plan-2026-08-14.md`; the branch is
`claude/default-research-instrument-plan` and its task file is in
`docs/agent-tasks/active/`. **Nothing is implemented**, so every claim elsewhere
in this file about a 24-question default, a three-colour answer scale or
contract `6.0` still describes the running product. One new external blocker
follows from it and is recorded under approval gates: the methodologist's
item-to-dimension mapping.

**2026-08-13 landed two commits of product code on the manager's own screens.**
`1d391e3` turned opening a school and opening a round into dialogs that state
what the save will do, gave the questionnaire builder a question the manager
writes themselves, took the second-attempt button off the respondent thank-you
screen, stopped the privacy tooltip being painted over by the panels below it,
pinned the setup screen's save button and save state to the bottom of the
viewport, replaced every `window.confirm` in the manager screens, and fixed a
defect where saving a new round twice opened two rounds. `45e1340` fixed the
second silent one: a round's name is edited on two screens, both wrote the
round's own column, only the builder wrote the copy inside the questionnaire
snapshot — so a rename on the setup screen was reverted by the next
questionnaire save, with nothing on screen to say so. The mirror now runs both
ways, as it already did for the privacy threshold.

**Both were fast-forwarded into `main` at the owner's request, not merged
through a pull request.** Verification on this tree: all three CI workflows
green on `45e1340` — Core verification, CodeQL, and Vercel Deployment &
Pipeline Checks (run #345). Core verification is the one that matters here,
because it runs `verify:core` whole with a Python virtualenv its own step
builds: the three AI cross-service tests that cannot run in a container without
`ai-analytics-service/.venv` are green on a runner that has one. Locally:
`npm test` 904 pass 3 fail — those same three, for the missing venv —
`npm run typecheck`, `npm run lint` and `npm run build` clean, plus two
Playwright smokes written for this work (19/19 and 8/8) driven against
`next start` on a Postgres started inside the container and stopped afterwards.

**Nothing about the deployed environment was established on 2026-08-13.** The
Vercel workflow's `Deploy to Production (Manual)` job is gated on
`workflow_dispatch` with `target_env: production` and was skipped, so Actions
deployed nothing; Vercel's own Git integration is expected to have built the
push regardless, as this file records below, but that was not read. The
endpoint is not reachable from the authoring container at all — `curl` to
`https://shalomut-map-demo.vercel.app/api/health/` fails to connect — so even
the anonymous liveness reading of 2026-08-11 could not be repeated. Treat the
deployed revision as unknown until someone reads it.

**2026-08-11 landed six commits of product code, all of the same kind: screens
that stopped claiming what the system does not do.** In order —
`18c74b3` the setup screen warns while the staff count is being typed that a
staff smaller than its own privacy threshold can never unlock (the API had
refused this since `staff-floor.ts`, but only after save); `7368148` the home
screen's status stones show `—` and the round's own threshold instead of `0`
while analytics are locked, so an empty round stops reading as a perfect
school; `257bb2f` a recommendation names the ISO 45003 clause or OECD TALIS
guideline it came from, a field the contract has carried since `1.0` and no
screen showed; `9d61916` the time a questionnaire asks for is computed from the
questions it asks, on both the builder and the consent screen; `187f14e` the
round's end date is labelled `סיום מתוכנן` and says when it has passed on a
round still collecting, because it closes nothing. Verification on this tree:
`npm test` 878 pass 0 fail, `npm run typecheck`, `npm run lint` and
`npm run build` clean, each change walked in a local production build. Every
task file is in `docs/agent-tasks/archive/`.

**The cheap-wins list of `docs/product-strategy-axes-2026-08-10.md` is closed
as engineering work.** Items 3–8 and 12 were already done when that list was
drafted or landed the same day; 2, 9, 10 and 11 landed on 2026-08-11. What
remains is item 1 — whether `GEMINI_API_KEY` is on a paid billing account,
which only the owner can read — and item 13, rewriting the questions and
anchors in the inclusive convention, which is methodology and belongs with the
answer-scale decision. Do not read the numbered list in that dated document as
a to-do; it is a snapshot of 2026-08-10. The one branch that
exists and is deliberately not on `main` is
`fix/manager-password-must-be-strong` — withdrawn work, described below, local
to one worktree. Verification on the tree that is on `main`: `npm test` 856
pass 0 fail, `npm run typecheck` and `npm run lint` clean. The browser suite's
last run was 18 passed, on the same product tree with the withdrawn commit on
top; nothing in that commit is reachable from a browser, but the number is
recorded as what it is rather than as a run of `main`.

**All four Tier 0 code items are closed, on `main` and deployed.** The four
branches landed as one linear stack — `test/respondent-path-e2e` (`0506169`,
item 4), `fix/questionnaire-speaks-to-everyone` (`5cf826e`, item 3),
`feat/security-headers` (`230ee44`, item 1) and `feat/rate-limiting`
(`568fbcb`, item 2) — and all four task files are now in
`docs/agent-tasks/archive/`. `docs/agent-tasks/active/` holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions.
Nothing is waiting on a push.

**What "deployed" means for each of them, because it is not the same claim
four times.** The Vercel deployments list was read on 2026-08-10 in the owner's
signed-in Chrome: `568fbcb` on `main` is `Ready`, built in 40s, carrying the
Production badge, with every earlier push of the stack `Ready` below it and no
failed or queued build anywhere in the list.

- **Item 1 is confirmed in the product**, anonymously with `curl -I` on the
  alias: `/`, `/login/`, `/api-docs/` and `/answer/NOT-A-REAL-CODE/` each carry
  exactly one `Content-Security-Policy` plus the five companion headers, `/`
  carries `frame-ancestors 'none'`, and only `/api-docs/` carries
  `https://unpkg.com`. Vercel adds nothing that conflicts. Not checked there:
  a signed-in walk under the enforced policy, and whether `/api-docs/` actually
  draws.
- **Items 2, 3 and 4 are deployed as code and nothing more.** Item 2's limiter
  has never refused a deployed request — proving it means eleven failed sign-ins
  and a five-minute lockout of the originating address, so it waits on the
  owner asking and on an address nobody needs. Item 3's slash wording cannot be
  read there while the deployed database holds no round, so there is no share
  link to open. Item 4 is a test, a seed and a Playwright project; none of them
  runs on Vercel at all.

**One probe to distrust.** `curl -sL .../openapi.json | grep RATE_LIMITED`
returned nothing for a dozen polls and read as a build that had not landed. It
had: `/openapi.json` is behind the manager gate, answers `307` to
`/login?next=%2Fopenapi.json`, and `-L` made the grep read the login page.
Every gated path anonymously probed has this shape — read the status with `-I`
rather than the body with `-L`.

Seven branches
landed that day, in this order: the product-strategy sweep (`b42b509`), the four
Tier 0 respondent-path fixes (`3df1a13`), the respondent funnel (`bf02dd1`), a
documentation close (`743c362`), the consent screen's truth (`93e3baa`),
observability (`e1ef1e1`), delta honesty (`c30a5fc`) and the staff-size refusal
(`e14e3ac`).

**Strategy axis 6 closed the same day**, in two more pushes:
`fix/comparison-reads-the-questionnaire` (`37960c4`) — a comparison between two
different questionnaires says so — and `feat/a-split-staff-room-is-visible`
(`301c329`, `8b08aaf`) — the map marks the dimensions whose answers split
between the two ends of the scale. Both were walked signed-in against a
production build on port 3210, because the dev server on port 3000 was serving
stale CSS for part of that session; a layout that looks broken there is worth
re-checking on a fresh build before it is called a defect.

**The stack landed on 2026-08-10.** Because it was linear, pushing the tip
carried the branches below it at once and the earlier ones were then rejected as
non-fast-forwards — which read like a failure and was not: `main` is `568fbcb`
and contains every commit of all four.

What each of them was:

`test/respondent-path-e2e` closes Tier 0 item 4;
`fix/questionnaire-speaks-to-everyone` closes item 3 — the
questionnaire's sixteen feminine-only sentences now address both genders in the
slash form the file already used for `המנהל/ת מעריכ/ה`. The published `2.0`
contract deliberately keeps the wording it shipped, so the default template and
`contracts/ai-analytics-v2.json` now differ on purpose; a canary test fails if
anyone "fixes" the manifest. Item 3 is the one that could not have been
repaired after a school started answering.

The first of the two also fixes the reason item 4 was invisible — the
seed wrote its round `closed`, so the one share link the project hands out led
to the dead-link screen, and the smoke test that claimed to open the
questionnaire had been passing against it. Verified by falsification: with the
round closed again, the new spec and the tightened smoke assertion fail and the
rest of the suite passes.

Axis 6 has nothing left in it; axis 7's second half still waits on the owner's
wording, not on engineering.

`feat/security-headers` closes item 1: the application sent none, and now every
response carries a CSP with `frame-ancestors 'none'`, plus `nosniff`,
`Referrer-Policy`, `X-Frame-Options`, a `Permissions-Policy` and HSTS without
`preload`. `/api-docs` has its own header for unpkg and a test that keeps that
exception off the manager screens. Enforced rather than report-only, after
every screen was walked in a browser with a violation listener attached and
came back clean. One limit is written into the config and
`docs/data-flow-and-subprocessors.md`: `script-src` keeps `'unsafe-inline'`
because Next serves inline RSC scripts and the nonce alternative would make
`/login` dynamic. The endpoint reading is at the top of this file.

`feat/rate-limiting` closes item 2, the last of the four. Sign-in is limited to
ten attempts per address per
five minutes — counted before the password is read, so the refusal cannot be
used as an oracle — and the respondent submission to sixty, deliberately loose
because a staffroom answers from one school address and refusing them would be
worse than the abuse it prevents. Addresses are never stored: the key is a
salted hash that expires with the window.

**Upstash is prepared, stays off, and is no longer a pre-pilot gate — owner
decision, 2026-08-10, revised the same day.** The first decision was to switch
it on before the pilot. It was reconsidered and the gate was replaced by a
generated manager password, for a reason worth keeping:

The in-memory counters are per-instance, so on serverless the effective ceiling
is the limit times however many instances are warm — and the number of warm
instances is set by the attacker's own parallelism, not by how few real users
the product has. Twenty concurrent instances is roughly 200 attempts per five
minutes, about 57 000 a day. **But that number only decides anything against a
guessable password.** Against `admin123` it is fatal with or without Upstash;
against `openssl rand -hex 32` it is nothing, and no shared counter is needed.
Rate limiting rescues a weak password; it does not make one safe, and it is not
what a strong one needs.

So the gate that actually protects a school's answers is the password, and it
now sits under the pre-pilot list in place of Upstash. **Nothing in the code
enforces this, by decision**: `ManagerAuthenticationService` requires the
variable to be non-empty and would accept `123`
(`src/lib/auth/manager-auth-service.ts`). That is why it is written down here
and in `.env.example` rather than left to judgement.

**The enforcement was built and then withdrawn the same day, 2026-08-10 — owner
decision, and it waits on a second manager.** The rule refused a deployed
runtime a password under sixteen characters, with fewer than eight distinct
ones, or a well-known value, answering `UNCONFIGURED` and naming the rule in the
server log only. It was verified in both directions over HTTP against a
production build and never pushed. The reason it waits: with one operator who
sets the variable once, the requirement is that person's habit, and a rule that
can lock them out of their own deployment costs more than it protects. When
passwords start being chosen by people who have not read `.env.example`,
enforcement earns its keep — so it is recorded as part of
`docs/product-behaviour-backlog.md` §8 rather than as a loose idea. The code
sits unpushed on the local branch `fix/manager-password-must-be-strong`, which
means **this worktree only**: it is not on any remote and another checkout
cannot see it. If that branch is ever lost, the backlog entry is the record and
the work is a couple of hours.

What the in-memory limiter still buys, and why it stays: it stops a script
hammering either endpoint from one address, it makes the refusal visible in the
logs, and it costs nothing. What is given up by not enabling Upstash: a counter
that holds across instances, which matters against a distributed attempt on a
password worth attempting. If the password is generated, there is no such
password.

Upstash remains two environment variables away, its code path is verified (see
below), and nothing needs rewriting to turn it on later.

Switching it on is two environment variables — `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` — and nothing else: the REST API is called directly,
so there is no dependency to install and no code change to make. One thing
follows when it happens: Upstash becomes a fourth processor and belongs in any
subprocessor list.

**The Upstash code path is no longer unexecuted, 2026-08-10.** It was run
locally against a stub speaking the same REST pipeline API — no account, no
credentials, no network. What it establishes: the store POSTs to `/pipeline`
with `[["INCR", key], ["EXPIRE", key, "300", "NX"]]` and a bearer token; all
twelve sign-ins reach the store rather than any local cache, so the counter is
genuinely shared; the tenth is allowed and the eleventh refused with
`retryAfter: 300`; `EXPIRE` carries `NX`, so the stub's second call leaves the
window where it was and a burst cannot push the reset away; the key is
`shalomut:rl:manager-login:<32 hex>` with the address nowhere in it, and the two
policies key separately. Fail-open was exercised in both of its shapes — a
rejected token (`Upstash answered 401`) and an unreachable host (`fetch
failed`) — and each logged `Rate limit store unavailable; request allowed` and
let the request through. So a wrong credential costs the limiter, never the
manager's access.

What that does **not** establish is Upstash itself: the stub is this
repository's reading of the REST contract, not the vendor's server. The first
real execution is still the first deployed request after the variables are set,
and the check at that moment is the logs — `Rate limit store unavailable` there
means the URL or the token is wrong, and nothing on any screen will look
broken, because it fails open by design.

What is left of the readiness
list is outside the repository and the owner's: rotating the four exposed
credentials, the legal artifacts (privacy notice, subprocessor list, retention,
deletion route), the availability monitor on Core, and the `שימוש הוגן`
wording from axis 7.

`20260810101610_add_survey_attempts` is applied to the deployed database; twelve
migrations, all applied. The deployed AI service still reports `9c46355`, which
remains correct: nothing since has touched `ai-analytics-service/`, and its
`buildFilter` is why.

**Due before the first pilot school, not before merge:**

- **Generate `MANAGER_ADMIN_PASSWORD` during the credential rotation —
  `openssl rand -hex 32` — and do not choose one by hand.** This replaced the
  Upstash gate on 2026-08-10; see below for why the swap is honest rather than
  a downgrade. The rotation was already due before the first real respondent,
  so this adds no step, only a shape. The owner's own hands: no agent sees or
  types this value.
- Rotate the four exposed credentials. The strategy document already states
  this as due before the first real respondent rather than after.

**Three things this repository cannot do, all now the owner's:**

1. Create an uptime monitor against `/api/health` on the deployed Core endpoint.
   The route was opened anonymously for exactly this and nothing walks through
   it yet.
2. Decide where the structured observability lines land — a log sink or an error
   tracker — and with which alert. The first alert worth having is on the
   deterministic-fallback ratio.
3. Answer the open questions of `docs/product-strategy-axes-2026-08-10.md`
   axis 1 (the Chief Scientist directive, Amendment 13) and axis 7 (the fair-use
   commitment, and how small a staff room is too small to measure safely). Both
   are wording and legal judgement, not engineering.

Nothing from this session was observed on the deployed endpoint: its database
holds no round, so there is no link to open, no funnel to read and no comparison
to render. The first deployed round is what will exercise all three.

The paragraphs below were written on 2026-08-09 and describe that session.
**The AI analysis had stopped being written by the model,
and the two settings behind it are now declared rather than defaulted.**
`MAX_TOKENS_PER_DIMENSION` was unset everywhere, so both halves ran on the
service default of 2048 and every dimension came back `finish_reason=length`;
it is `8192` now, in `render.yaml` and `.env.example` (`aefec31`). With the
ceiling raised, the deployed fast model `gemini-3.5-flash-lite` turned out to
splice Arabic letters into Hebrew words — `מתורجם`, `בمשימות`, `לبחון` — which
the Hebrew-only gate refused, fourteen answers of twenty-one; the fast tier is
`gemini-3.5-flash` now, which produced zero refusals on the same round, and the
V6 summary and metric nodes finally tell a refused answer which gate it hit
instead of re-sending the same prompt (`9c46355`, 480 Python tests).

**Proven end to end on the local stack after those changes**: the analysis was
started from the round screen, `succeeded` on attempt 1 in about three minutes,
contract `6.0`, **eight stones of eight with `llm` provenance and no validator
refusal**. All 305 Hebrew strings of the stored result were scanned: no Arabic
and no Cyrillic. The only Latin left is in `recommendedInterventions[].source`,
which cites standards like `ISO 45003` and comes from the catalog, not the
model. Nothing equivalent has run on the deployed endpoint — its database is
empty, so there is no round there to analyse.

**A local-environment trap worth knowing**: `.env.local` overrides `.env`, in
`scripts/local-stack.mjs` and in Next.js both, and it pinned
`AI_ANALYTICS_CONTRACT_VERSION=5.0`. A local run was therefore exercising a
lighter contract than the deployment produces, silently. It is `6.0` there now.
The stack banner prints the version it resolved, which is the only reason this
was caught — read that line after changing any env file.

Before that, three fixes landed after the
decision below, all pushed by the owner: the builder's round switcher now
crosses the server/client boundary as data rather than as markup (`0f13481`,
which removes a React key warning on every load of that screen), `render.yaml`
gained a `buildFilter` so only the AI service's own paths rebuild it
(`7949d8a`), and the builder's keyboard legend can wrap (`8986bd3`, which is
what had been dragging that panel's whole contents out of view). Both screen
fixes were walked on the local server only — measured at 1728px and 1180px,
console clean — and not on the endpoint: with the deployed database empty there
is no round to open the builder on. Vercel has the code; nobody has looked at
it there.

**Both databases were emptied on request and only the local one was reseeded.**
The deployed Supabase database holds no organization, round, response or answer
— 2 organizations, 3 rounds, 20 responses, 510 answers and 2 AI runs were
deleted on 2026-08-09; the schema and its migrations are untouched. The local
container was emptied the same way and then reseeded with
`npm run db:seed:local`, so it holds one school and one closed round of twelve
responses. Deployed screens now serve the onboarding state, which was confirmed
in the browser; anything below that describes deployed *data* is a record of
what was there, not of what is there.

Before that, the last thing to land was a
decision rather than a change: backlog §5's two open goal questions are both
answered "no" — a goal gains no owner, due date or plan of steps, and no number
is shown beside it. Recorded in the backlog item, in ADR-015 and in the open
list below; no runtime file changed.

Before it, the last product change was the scope dead end a manager could reach
with no action on the screen at all: a
request naming no school the system has now offers the schools it could not
choose between. It was walked in the owner's signed-in Chrome twice — on the
local server before the push and on the deployed endpoint after it — and both
walks are recorded in
`docs/agent-tasks/archive/fix--scope-required-has-a-way-out.md`.

Every finding of the
2026-08-09 deployed end-to-end smoke is fixed, pushed and confirmed on the
endpoint — the seven items and their evidence are in the deployed-state section,
and each task file is now in `docs/agent-tasks/archive/`. Two of the seven
changed data on the deployed database and the owner approved that first; what
changed is recorded below.

The throwaway data those walks left behind has since been removed: the E2E
school and its three rounds are off the deployed database, deleted by name
rather than by emptying it. `docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which is waiting on owner decisions
and not on an agent. Nothing is waiting on a push.

The paragraphs that follow describe the 2026-08-08 session and are kept as they
were written (`origin/main` was `7434ed5` then). The session's
product changes are the sign-in transition fix `8d4af8d`, confirmed on the
deployed endpoint by the owner; the frontend UI/UX audit — seven branches
pushed as one stack, of which the only thing a manager sees is the new skip
link, everything else proved inert by a computed-style fingerprint or
documentation; and the privacy tooltip fix `5ffdd91`.

The tooltip bug was found by walking the deployed product in the owner's
signed-in browser: the bullet lead-ins rendered at 46.4px on the home screen. It
shipped with the component and the audit's own refactor of that component walked
past it. It is now fixed, pushed and confirmed on the endpoint — details in the
deployed-state section — and `docs/agent-tasks/active/` is empty again.

The check that caught the tooltip now stands as the seventh end-to-end test
(`4fc3a26`): it enumerates every text node in the open tooltip and fails if any
exceeds 17px. `npx playwright test e2e/` is 7/7 locally, CI is green at that
commit with its browser smoke step included, and the test was proved to fail on
exactly the three 46.4px lead-ins with the fix removed.

Nothing is waiting on a push except the documentation commit that carries this
sentence, and `docs/agent-tasks/active/` is empty: every task this session
opened is closed and archived.

This document owns only cross-task operational/deployed state, external
blockers and approval gates. Product milestones belong in `PROGRESS.md`; branch
work and exact verification belong in `docs/agent-tasks/{active,archive}/`;
older snapshots remain available in Git.

## Repository snapshot

- **A workaround inside the browser smoke was hiding a real defect, and it is
  fixed.** `8d4af8d`: the first sign-in of a browser session never left
  `/login`. The login screen's brand `<Link href="/">` prefetches the home page
  while the manager is still signed out, the middleware answers that prefetch
  with a redirect back to `/login`, and the client router caches it — so once
  the cookie was set, `router.push("/")` was served from that cache, reached no
  server and landed where it already was. The form does not clear its loading
  state on the success path, by design, so it spun on "מתחבר..." with no way
  out. Reloading `/login` was the owner's own workaround and explains the rest
  of the report: with a cookie present the prefetch returns the real home
  screen. Fixed by a document navigation on sign-in and, mirrored, on sign-out.
  `?next=` is filtered to a same-origin path in the same commit — it was an
  open redirect through `router.push` already, and a real navigation raised the
  cost of leaving it. The regression is `e2e/login-transition.spec.ts`.
- **Correction, same day.** The entry above first claimed that the workaround
  in `e2e/smoke.spec.ts` — `signIn` navigating to the destination itself rather
  than waiting for the form — had hidden this bug. Checked afterwards by
  removing the workaround and running it against the pre-fix code: it still
  passed. The defect needed a destination the login screen had already
  prefetched while signed out, which is `/`; the smoke signs in towards
  `/round` and `/dashboard` and was never affected. What the workaround did
  hide was a wrong diagnosis — its comment blamed the router for a flake — and
  that is the part worth carrying. The workaround is gone as of `1c2da29`,
  which buys coverage of the `?next=` deep-link path rather than of this bug.
- **The browser smoke found a session bug the whole suite was blind to.** The
  middleware verified JWTs by passing `signatureBytes.buffer` to
  `crypto.subtle.verify`; it runs in a sandbox with its own realm, so that
  ArrayBuffer failed an `instanceof` check inside SubtleCrypto and the call
  threw before reading a signature — on Node 20, which CI pins, and not on the
  Node 22/24 used locally. Route handlers, outside that sandbox, kept issuing
  valid sessions, so a manager could sign in and every protected page still
  bounced to `/login`. Fixed by passing the typed array. **The deployed endpoint was never
  affected**, and this was checked rather than assumed: on 2026-08-07 the owner
  signed in on deployment `515kx96zg`, which serves `46fcde7` — the commit
  immediately before the fix — and there `/api/auth/me` answered
  `authenticated: true`, `/round/` answered 200 without a redirect, and the
  manager screen rendered. Vercel runs middleware in its own Edge isolate
  rather than Next's Node sandbox, so the cross-realm check never tripped
  there. The bug reached only runtimes where the middleware executes under
  Node 20: CI, and `next start` on Node 20 if this is ever self-hosted.
- **`main` is green.** Run 31207956670 at `0524542` is the first full pass,
  smoke step included, 4/4. It took three red runs to get there and each named
  a different real defect: `31191748609` — `npm run db:seed:local` called
  `getRepositories`, an export the composition root had replaced, so the seed
  had been dying at its first line, invisible until something re-seeded;
  `31195236422` and `31205427782` — the middleware could not verify a session
  on Node 20, described above.
- `origin/main` is `6e06ff7`. The last commit that changed **product** code is
  `8d4af8d`, the sign-in transition fix above. Before it the
  product-visible tip was `26209f3`, the session-verification fix. Before it,
  the product-visible tip was `36fe4ce` — `feat/multi-school-scope`, pushed by
  the owner on 2026-08-07: the system holds more than one school, `/setup` is
  where one is chosen and added, and every other screen reads inside the chosen
  school. Before it, `main` was `bc00512`, itself the tail of
  `feat/round-context-across-screens` (`9983184`).
- **Three test-only branches landed on 2026-08-07**, pushed by the owner in two
  goes: `test/legacy-contract-refusals`, `test/v5-contract-refusals` and
  `test/v6-contract-refusals`. Together they gave contracts `1.0`–`3.0`, `5.0`
  and `6.0` the refusing half of their tests; the mutation pilot moved 71.81%
  to 95.22%. No runtime file changed. Their task files are in
  `docs/agent-tasks/archive/`.
- **`chore/contract-refusal-suite-check` landed the same day.** `npm run
  lint:contract-refusals` runs inside `verify:core`, so CI fails when a
  contract version reaches a stone validator that no `*-refusals.test.ts`
  exercises. It groups versions by the capability flags
  `validateStoneMapResult` branches on — `4.0` shares `3.0`'s path and needs no
  suite — and reads that flag list out of `ai-contract.ts` so it cannot go
  stale. It proves a suite exists, not that it is complete.
- **A browser smoke landed on 2026-08-07.** `npm run test:e2e` starts its own
  production server with credentials it invents, signs a manager in, reads the
  round's share link, opens it as a respondent and looks at the dashboard. CI
  runs it after `npm run verify`, seeding the disposable service database
  first. The job declares one throwaway `SESSION_SECRET` so the build and the
  server share it; none of the repository's real secrets are read. It replaces the
  manual browser walk as a regression check — not as a substitute for walking
  new screens.
- **`npm test` now needs `ai-analytics-service/.venv`, and every worktree needs
  its own.** Landed 2026-08-12 with `chore/python-from-the-service-venv`. The
  cross-service test used to spawn a bare `python3`; on macOS that is the 3.9
  from the Command Line Tools, below the service's `requires-python`, so three
  tests failed with an ImportError from inside the service and `verify:core`
  could not finish. Every Node-side caller now resolves the interpreter through
  `scripts/ai-service-python.mjs`, which names the missing virtualenv and
  `docs/local-environment.md` instead of falling through to PATH, and
  `npm run lint:interpreter` — in `verify:core` — fails on a `python3` spawned
  by name anywhere in `scripts/`, `src/`, `e2e/`, `package.json` or
  `.github/workflows/`. Two consequences for anyone starting fresh: `.venv/` is
  gitignored, so a new worktree has none until it makes one, and the setup
  command needs the `[dev]` extra — `pip install -e ".[dev]"` — because plain
  `-e .` installs no pytest and the documentation said otherwise until this
  branch.
- **Actions are on current majors, and Dependabot keeps them there.** Landed
  2026-08-12. Every `uses:` moved off the Node 20 action runtime —
  `checkout`/`setup-node`/`setup-python`/`upload-artifact` to `v7`,
  `codeql-action` to `v4` — and all three edited workflows are green with the
  deprecation annotation gone. `.github/dependabot.yml` now opens one grouped
  `ci:`-prefixed pull request a month for the `github-actions` ecosystem only,
  so a bump arriving as a PR is expected, not a stray. Both CI gates run on it
  before merge: `deploy-vercel.yml` on `pull_request`, `verify-core.yml` on the
  pushed branch. `npm` and `pip` are deliberately not covered. The one line no
  green run could reach — `upload-artifact@v7` behind `if: failure()` — was
  exercised on purpose on 2026-08-12 and works: run `31588584933` uploaded a
  1 MB `playwright-report` that opens with the screenshot and traces intact.
  Dependabot itself is still unproven until the first monthly pull request
  arrives.
- **`.github/workflows/verify-core.yml` runs `npm run verify:core` on every
  push, on every branch.** Until 2026-08-12 the only verification job was the
  one inside `deploy-vercel.yml`, which triggers on `main` and on pull requests
  to it, so a branch or an agent worktree was unverified until it landed. The
  new job carries no Postgres service, no browsers and no seed — `verify:core`
  needs none of them — and it installs `ai-analytics-service/.venv` with the
  exact command `docs/local-environment.md` gives, so a green run also proves
  the documented setup. On `main` it overlaps `deploy-vercel.yml` deliberately:
  the two run in parallel and this one reports first. `verify:db`, `verify:ai`
  and the browser smoke stay in the deploy workflow, which remains the gate a
  deployment waits on.
- **The build no longer downloads its own typeface.** 2026-08-12. Noto Sans
  Hebrew is committed at `src/app/fonts/noto-sans-hebrew-variable.woff2` and
  loaded through `next/font/local`; `npm run lint:fonts` in `verify:core` fails
  on `next/font/google`, on a Google font host in code or CSS, and on a
  `next/font/local` source that is not on disk. The reason is operational rather
  than aesthetic: `Core verification` `31582875968` went red on `main` at
  `e9020f8` because Google served a stale stylesheet and all five `.woff2` files
  404ed, while the same commit built cleanly in `deploy-vercel.yml` at the same
  minute. A re-run went green in one try. Treat any future
  `@vercel/turbopack-next/internal/font/google/font` failure as a signal that
  this was reverted, because nothing else can produce it now. On `main` as
  `61900c6`…`790f4c9`; the deployment serves the committed file byte for byte
  under an immutable cache, and preloads it, so a font request leaving for
  Google would now be a regression visible in the document head.
- **Two gates were considered and declined on 2026-08-07**, so they are not
  reopened by habit: a mutation-score threshold (the score moves for reasons
  unrelated to test strength) and a line-coverage threshold (it would have been
  green throughout the period when ~90 validator rules could be deleted
  silently — those lines executed, they were simply never asserted against).
  A nightly full mutation run was also declined as a number nobody would read.
- **The deployed commit was read back on 2026-08-07**, in the Vercel dashboard:
  Production is `807eccc`, `Ready`, and the deployments list shows every push to
  `main` that day building on its own. Sign-in and the round screen were walked
  there in the owner's signed-in browser and both work.
- Five branches reached `main` on 2026-08-05, each as a fast-forward the owner
  pushed themselves: `feat/survey-definition-history` (backlog §1),
  `feat/archived-rounds-read-only` (§10), `feat/goals-across-rounds` (§5), plus
  `docs/close-causal-refusal-decision` and `docs/roadmap-reconciliation`. All
  are fully contained in `main` and can be deleted; their task files are in
  `docs/agent-tasks/archive/`.
- **Nothing is waiting on a push.** The documentation commit recording the
  deployed check above is `a968dcd`, and it is `origin/main`.
  `docs/agent-tasks/active/` is empty; the task file is in
  `docs/agent-tasks/archive/`. The last product branch, `feat/multi-school-scope`,
  landed on 2026-08-07, is fully contained in `main` and was walked in the
  owner's signed-in browser before the push; its task file is archived.
- The one unmerged branch, `fix/refuse-asserted-causes`, is a decided **no**
  and is described below.
- **No migration is pending on the deployed database.** The eleventh,
  `20260805170000_add_survey_definition_versions`, was applied on 2026-08-05
  immediately after the push that carried its code — the build command runs
  `prisma generate`, never `prisma migrate deploy`, so this is a hand step every
  schema change still needs. Details and the read-back are in the database
  section below. Nothing after it changed a schema.
- Verification at `8d4af8d`: `npm run verify:core` exit 0 with 739 TypeScript
  tests, all five fitness checks, typecheck, ESLint and the production build,
  plus `npx playwright test e2e/` 6/6 against the local development database.
  `verify:db`, `verify:ai`, the Python suite and the mutation run were **not**
  run: no schema, repository, contract, Python or mutated module is in that
  diff. CI at `8d4af8d` was not read back. The deployed confirmation is the
  owner's own first sign-in, which entered immediately.
- Verification at the earlier `test/browser-smoke` tip: `npm run verify:core` exit 0
  with 736 TypeScript tests, all five fitness checks, typecheck, ESLint and the
  production build, plus `npm run test:e2e` 4/4 against the local development
  database and a Node 20 container reproduction that answers 200 on a protected
  page where it answered 307 before the fix. CI ran the same suite green at
  `0524542`, smoke step included. The last full mutation run was at `ae73259` — nothing after
  it touched a mutated module or the runner's test list — and was exit 0 (1155
  killed, 52 survived, 6 uncovered, 42 runtime errors, 95.22%). `verify:db` and
  `verify:ai` were **not** run — nothing since 2026-08-05 morning changed a
  schema, a repository, a contract or Python. The last `verify:db` reading is 26 tests, 26 pass at
  `763e38f`, against local PostgreSQL on `127.0.0.1:5433`.
- **The manager screens have now been walked in a browser**, on 2026-08-06,
  with the owner signed in on the local dev server. This closes the gap the
  2026-08-05 entry recorded. It was worth doing: the walk found three defects
  that the test suite did not — stale client state across a round switch, a
  duplicate React key that rendered two rounds' controls at once, and a link
  that dropped the round. All are fixed in `c67471c`. A signed-in walk remains
  the check that a rendering test cannot stand in for — the 2026-08-07 walk of
  the school switcher found another one the suite had missed, the setup form
  keeping its save state across a switch (`a0f5306`).
- The local development database now holds the same one school it held before
  2026-08-07: a second school was created through the UI during that walk and
  deleted afterwards at the owner's request. The deployed database was not
  touched.
- Deployment of `9983184` was read on 2026-08-06 and is `Ready`; see the
  deployed-state section.
- Superseded snapshot: `origin/main` was `45f38c2` — the round archive.
  Verification there: `verify:core` exit 0 with 576 tests; `verify:db` and
  `verify:ai` not run, and the archive flow not smoke-tested in a browser.
- Older snapshots of this pointer were trimmed on 2026-08-05. They had grown
  into a session log of every push since 2026-08-02, which is what Git and the
  archived task files already hold, and this document is supposed to say what
  is true now. `git log --oneline main` and `docs/agent-tasks/archive/` carry
  the same history with the commits attached. Everything the trimmed entries
  recorded as an approval gate, a deployed fact or an external blocker is
  preserved in the sections below rather than in that chain.

## Deployed state

- **The 2026-08-09 smoke's seven findings are deployed and confirmed on the
  endpoint, 2026-08-09**, in the owner's signed-in Chrome. `origin/main` is
  `90a507c`; the served stylesheet carries the new `.round-delta` pill and
  `.manager-onboarding-schools`, so the deployment is that stack rather than a
  near miss. What was checked, in the product rather than in the build:
  - a draft round (`סבב שני E2E`) shows no `זהו סבב קודם` banner, keeps
    `איפוס נתונים` and `רענון ניתוח`, and its close button is disabled with the
    title `סגירה ידנית אפשרית רק לסבב שאוסף תשובות`;
  - `/setup/?round=new` renders six navigation links and a brand link, none
    carrying `round=new`;
  - a link to another school's round shows the dead end *with* a school
    switcher, and choosing that school lands on
    `/round/?school=…&round=…` — the round the link was for, in its own school;
  - on `טסט`'s map every delta chip sits on `--surface` at 5.17–6.87:1,
    including two real `±0` chips at 5.41:1 — the `0`-beside-`52%` case the
    finding named;
  - a round opened from the setup screen arrives with 24 questions as a draft,
    while `סבב שני E2E`, created before the change, still has 0 — the two sit in
    the same school as a before and after;
  - the round that was collecting (`סבב ראשון E2E`) was still `פעיל` after that
    round was opened;
  - saving the questionnaire flipped the builder's switcher from
    `סבב ראשון E2E — פעיל` / `סבב שלישי E2E — טיוטה` to
    `סבב שלישי E2E — פעיל` / `סבב ראשון E2E — סגור` with no reload.
- **What that verification changed on the deployed database**, with the owner's
  approval, all inside `בית ספר בדיקת E2E` (`ff5625a8`): a round
  `סבב שלישי E2E` (`b19be646`) was created and is now the school's active round,
  and `סבב ראשון E2E` (`f1cc7f0a`) was closed by that activation, as one active
  round per school requires. No other school was written to; switching schools
  during the walk only moved the browser's own cookie, which was returned to
  `ff5625a8`.
- **That school is now off the deployed database**, on the owner's instruction,
  2026-08-09. `בית ספר בדיקת E2E` (`ff5625a8`) and its three rounds were deleted
  with `scripts/clear-test-data.ts`, which removes named ids rather than
  emptying tables the way `db:clear` does. What remains is the two manager
  schools, their three rounds, 20 responses and 510 answers — the state that
  predates the walks. `סבב בדיקה E2E 2` (`9c78768b`) was left in place on
  purpose: it is named like a test round but holds the unlocked analytics and
  the round-over-round deltas inside `טסט`.
- Known dead end, found while verifying that deletion: a session whose
  `shalomut_school` cookie names a deleted school lands on
  `נדרש שיוך לבית ספר` with no school switcher — the same shape finding #6
  fixed for `round-not-found`. **Fixed and on `main`** as
  `fix/scope-required-has-a-way-out`, pushed by the owner on 2026-08-09
  (`origin/main` is `1b49e86`): the state now offers the schools it could not
  choose between, and choosing one reopens the screen the manager was on and
  replaces the stale cookie. Walked in the owner's signed-in Chrome on the local
  server and then **on the deployed endpoint after the push**, 2026-08-09 — the
  chain from this state through `round-not-found` and back to a school's own home
  screen was exercised end to end in both places; the evidence is in the archived
  task file. A deleted school turns out not to be needed to reach it: the
  middleware writes `?school=` to the cookie without checking the school exists,
  so any unknown id produces the same state. The deployed walk wrote nothing to
  the database — the only state it changes is the browser's own cookie, which was
  returned to `טסט` at the end.
- Supported product environments remain local and deployed only.
- Core endpoint: `https://shalomut-map-demo.vercel.app/`. Vercel names the
  target Production; for the product it is the design-stage operational staging
  endpoint.
- **The frontend audit is deployed and checked on the endpoint, 2026-08-08.**
  The served stylesheet chunk is `2go2uobe7cagm.css` — the same content-hashed
  name and the same 103 855 bytes a local build produces from `213e59b`, so the
  deployment is that commit rather than a near miss. It carries `.skip-link`,
  the six `.privacy-tooltip-*` rules and `--z-skip-link`. `/login/` serves the
  rewritten `login-shell` markup and `/answer/NOT-A-REAL-CODE/` serves
  «הקישור אינו פעיל».
- **The manager screens were then walked in the owner's signed-in Chrome,
  2026-08-08**, which is what the public probes could not reach. Confirmed on
  the endpoint: the skip link is the first Tab stop, draws the navy ring at
  `z-index` 100 over the sticky header and lands focus on `#main-content`
  ringless; `.site-header` still lays out flex/centre/space-between/16px with
  its four Tailwind utilities gone; the builder's search draws
  `rgb(45,48,126) solid 3px` at 3px offset on `/`; and all eight map stones
  carry the same `--plus-top`/`--plus-left` they had before the geometry moved
  into `DimensionPresentation`. The walk also found the tooltip bug named at
  the top of this file.
- **The tooltip fix is deployed and confirmed, 2026-08-08.** The chunk rolled
  over to `1jqn_40hp-si6.css`, 103 928 bytes, byte-identical to a local build of
  `57dda52` (`cmp` clean), carrying
  `privacy-tooltip-reasons strong{font-size:.88rem}`. With the tooltip open on
  `/` in the owner's signed-in Chrome: the three bullet lead-ins measure 14.08px
  where they measured 46.4px, no text node in the panel exceeds 17px, the panel
  is 371x386 fully inside the viewport and not scrolling, and `.stat-stone >
  strong` is still 46.4px — the stone's own number was not quieted along with
  the tooltip.
- **The seven incidental AI-service findings of 2026-08-09 are all fixed, on
  `main` (`5188bfa`) and now deployed.** Six of the seven are inside
  `ai-analytics-service` and needed the Render container rebuilt from `main`.
  That has happened: anonymous `GET /health` on 2026-08-09 answered
  `commit: 2e80b6a`, which is `origin/main` itself, `status: online`,
  `env: production`, `supportedContractVersions` `1.0`–`6.0`,
  `jobPollingEnabled: true`. Render rebuilt on every push to `main` by itself,
  so this needed no hand step. Since the `buildFilter` of 2026-08-09 that is
  true only of pushes that touch the service's own paths. Deployed code, not deployed behaviour: no round
  has been analysed there since.

- AI service: Render container from the root `Dockerfile`, with durable polling
  enabled. The service needs an always-available process or explicit wake
  mechanism; scale-to-zero alone is not a reliable worker. An inbound
  `GET /health` resets the free plan's fifteen-minute sleep timer, which the
  service's own outbound polling does not.
- **GitHub Actions is not the keep-alive, and the reason is measured.**
  `.github/workflows/render-keepalive.yml` carried `schedule: */10 * * * *` from
  14:21Z on 2026-08-05. The run list was read every two minutes until 16:05Z:
  ten cron windows passed and not one scheduled run ever appeared, while the
  manual `workflow_dispatch` finished green in 9s with `status: online` and
  `commit: 80930a4`. The workflow was `active` throughout, so this was not
  GitHub's sixty-day idle rule. GitHub's scheduler is best-effort, skips runs
  under load rather than queueing them, and throttles short periods hardest.
  Owner decision 2026-08-05: move the keep-alive to an external pinger. The
  `schedule` block is gone; what the workflow still offers is a manual wake
  before a demo or a round.
- **The keep-alive is an external uptime monitor, and it exists.** UptimeRobot,
  free plan, in the owner's own account: monitor `Shalomut AI analytics —
  keep-alive /health`, keyword type, `GET
  https://shalomut-ai-analytics.onrender.com/health` every five minutes — three
  times the rate the fifteen-minute sleep timer needs, so a skipped check costs
  nothing. Created 2026-08-05 in the owner's signed-in browser, with the owner
  confirming the settings before it was saved. It reported `Up` with 100%
  uptime at its first checks.
- Keyword rather than plain HTTP: it fails unless the body contains
  `"status":"online"`, so a `200` from an edge in front of an unhealthy
  container does not read as alive. Alerts go to the account e-mail, with no
  delay and no repeat. Nothing secret is involved — `/health` is public and
  returns no respondent data.
- **The instance was awake on 2026-08-08, three days later.** Anonymous
  `GET /health` answered `200` in **0.43s** with `status: online`,
  `env: production`, `privacyThreshold: 10`, `supportedContractVersions`
  `1.0`–`6.0`, `jobPollingEnabled: true`. Sub-second is the load-bearing part:
  a cold free instance spends tens of seconds starting, so this container had
  not been allowed to sleep. That is one reading of the effect, not the
  monitor's own history.
- **The monitor's own history was read on 2026-08-08**, in the owner's
  signed-in Chrome (monitor `803671546`): `Up`, last check 54s before the
  reading, every 5m, **99.869% over both 7 and 30 days — one incident, 5m 5s
  down**. The last 24 hours are 100% with 0 incidents, which is why that figure
  alone would have been misleading; the incident is older than that window.
  Response time over the preceding hour: 174ms average, 167–180ms, all warm.
- **The one incident: 2026-08-07, 05:01:22 GMT+3, root cause `Connection
  Timeout`, duration 5m 5s, resolved.** That is exactly one check interval, so
  a single check failed and the next succeeded. From outside, two causes look
  identical here and the monitor cannot tell them apart: a transient network
  timeout, or the container having slept and the ping itself paying for the
  cold start. The second reading is plausible — 05:01 local is the quiet part
  of the night — and it would mean the keep-alive recovers a sleep within one
  interval rather than always preventing one. Either way the cost is bounded:
  one five-minute window in three days, and no analysis job runs at that hour
  yet. Do not upgrade this to a known sleep; it is one timeout with two
  explanations.
- If the service starts sleeping again, that monitor is the first thing to
  check, before anything in this repository.
- **The monitor's first real alert was a deploy, not a sleep — 2026-08-09,
  20:27:28 GMT+3, `502 Bad Gateway`, four US regions, ongoing for minutes.** A
  docs-only push (`6d03ea7`) at 20:08 had rebuilt this service, and a free
  instance has no zero-downtime swap: the old container stops before the new one
  answers. At 20:35 anonymous `GET /health` answered `200` — 22.6s on the first
  request and 0.21s on the third, the new container's cold start — reporting
  `commit: 6d03ea7`, `status: online`, `env: production`, `privacyThreshold: 10`,
  `supportedContractVersions` `1.0`–`6.0`, `jobPollingEnabled: true`. Read the
  alert as the deploy it was: the keep-alive was working, and the outage was a
  push.
- **`render.yaml` now carries a `buildFilter`, so Core-only and docs-only pushes
  no longer rebuild this service.** Its paths are `ai-analytics-service/**`,
  `contracts/**`, `Dockerfile` and `render.yaml` — `.dockerignore`'s allowlist
  plus the blueprint itself. One consequence to keep in mind when reading a
  deployment: **`/health`'s `commit` is no longer the tip of `main`**, it is the
  last commit that touched those paths. A newer tip is not evidence of a missing
  deploy any more; compare against the last Python-affecting commit instead.
- **The filter was proven the same day, by the first push that fell outside
  it.** `8986bd3` touches only `src/`, and afterwards `/health` still answered
  `commit: 7949d8a` — no rebuild, no 502 window, no alert. That is the check to
  repeat if the filter is ever suspected of being ignored: push something
  outside its paths and read `/health`.
- An always-awake instance costs nearly the account's whole free allowance of
  750 instance-hours a month, so a second free service does not fit beside it.
  The paid instance type is the version that needs neither a workflow nor a
  monitor.
- Database: the confirmed deployed Supabase PostgreSQL target contained all
  seven repository migrations after `prisma migrate deploy` and a successful
  follow-up `prisma migrate status` on 2026-08-02. The eighth,
  `20260804120000_one_active_round_per_organization`, was applied there on
  2026-08-04: `prisma migrate status` reports the schema up to date, and a
  read-back confirms `survey_rounds_one_active_per_organization` exists as a
  partial unique index on `(organization_id) WHERE status = 'active'`. No school
  held two active rounds when it was created, so the migration's cleanup step
  changed no row. The deployed database held one active round when this was
  read; it holds no rows at all since the clearing of 2026-08-09 described at
  the top. The index itself is part of the schema and survived it.
- The ninth migration, `20260804170000_add_round_goals`, was applied there on
  2026-08-04: `prisma migrate status` reports nine migrations and a schema that
  is up to date, and a read-back confirms `round_goals` with its unique key on
  `(round_id, dimension_id, title)`, its `(round_id, created_at)` index and a
  cascading foreign key to `survey_rounds`. The table holds no rows.
- The tenth migration, `20260804190000_add_round_updated_at`, was applied to the
  deployed database on 2026-08-04: `prisma migrate status` reports ten
  migrations and a schema that is up to date. It adds the nullable
  `survey_rounds.updated_at` that carries the manager screens' save time across
  a reload. The deployed round has `updated_at NULL`, so its setup screen shows
  no save time until someone saves once — the documented behaviour for a round
  written before the column existed.
- The eleventh migration, `20260805170000_add_survey_definition_versions`, was
  applied to the deployed database on 2026-08-05, right after the push that
  carried the code: `prisma migrate status` reports eleven migrations and a
  schema that is up to date. A read-back confirms `survey_definition_versions`
  with `id`, `round_id`, `definition jsonb` and `saved_at`, its
  `(round_id, saved_at)` index, and a foreign key to `survey_rounds` with
  `ON DELETE CASCADE`. The table holds no rows: the deployed round has not been
  saved since. No migration is pending.
- **`npm run db:migrate:deploy` targets the local database, not the deployed
  one.** It reads `.env`, which points at local PostgreSQL on purpose. The
  deployed database is reached by passing `DIRECT_URL` from
  `.env.deployed.local` as `DATABASE_URL`. This cost a broken deployment on
  2026-08-04: the push went out, the migration was run against local, reported
  success, and every round read on the deployed app returned 500 until the
  migration reached Supabase.
- Sequencing rule this leaves behind: the build command runs `prisma generate`,
  not `prisma migrate deploy`, so a schema change must reach the deployed
  database **before or immediately after** the push. Prisma selects the model's
  columns by name, so in between, every read of the changed table fails rather
  than falling back. The discriminating check when it happens: the previous
  deployment's own URL still answers correctly while the Production alias
  returns 500 — same database, so the difference is the schema the new build
  expects.
- No real respondents or production data exist. Database contents are
  disposable at this stage.

## Contract and AI runtime

- Contract `6.0` completed its consumer-first rollout. Deployed Python and Core
  support it, and deployed Core explicitly produces `6.0`.
- Unset Core configuration remains `5.0`, which is the rollback value. Core can
  produce `3.0`–`6.0`; callback/parser support spans `1.0`–`6.0`.
- The recorded deployed V6 round completed through durable claim, provider,
  callback, persistence and authenticated Dashboard rendering with eight
  stones, three summary paragraphs and five recommendations per stone.
- Runtime contract details and the rollout rule are canonical in
  `docs/ai-contract-version-matrix.md`; do not reconstruct them from old rollout
  plans.
- A durable run still refetches the round's aggregates instead of owning an
  immutable snapshot, so a response landing mid-analysis fails the callback with
  `round_validation_failed`. **The decision this was measuring is now answered
  by design rather than by rate.** Since 2026-08-17 analysis starts when a
  manager closes the round, and a closed round refuses submissions, so the
  ordinary way responses moved under a run no longer exists. The immutable
  input snapshot — Phase 1 of the AI harness improvement plan the owner is
  holding outside the repository — is no longer justified by this failure mode;
  anyone reviving it needs a different reason.
- **`ai_jobs_rearmed` no longer exists**, and a dashboard panel or alert built
  on it will read as a metric that stopped rather than one that was retired.
  It counted the re-arms of the automatic path, which was removed with that
  path on 2026-08-17. The residual race survives — `updateStatus` is not in a
  transaction with the dispatch, so a submission that read `active` can still
  land after the aggregates were read — and it is measured from the other end
  as `ai_jobs_failed{failureCode="round_validation_failed"}`. Point anything
  that watched the old counter at that label.

- Since 2026-08-09 a round that fails because the provider was unavailable
  reports why. `failureReason` keeps `provider_unavailable` as its prefix and
  appends the reason the run learned — `provider_unavailable_missing_api_key`,
  `provider_unavailable_http_429`, `provider_unavailable_retry_budget_exhausted`
  — and Core stores that string as the run's `failureCode` and as the label on
  its operational metric. **A dashboard or query that matched the old single
  value must group by prefix.** (Re-arming was unaffected by it either, and
  re-arming itself is gone since 2026-08-17.) No contract bump was involved; the
  field is additive and Core does not declare it.

- On contract `6.0` a silent provider does not fail a dimension: the structured
  summary and the metric narratives fall back to aggregate-derived copy and the
  round is reported `success`. Since 2026-08-04 that is disclosed rather than
  implicit — ADR-007 now describes it, the dimension screen tells the manager
  no model wrote those paragraphs, and every accepted map emits
  `ai_deterministic_summary_ratio_sample`. **Read that share before reading any
  round as evidence about the prompts**; on a rate-limited key it is close to 1
  while `ai_jobs_succeeded` looks healthy.
- Since 2026-08-04 `6.0` also declares `supportsPartialMaps`, and what produces
  a gap is repair exhaustion rather than a silent provider: when the budget is
  spent and every refusal left is one dimension's own copy, that dimension is
  reported as a stated gap instead of the round failing whole. Gated on the
  capability, so `5.0` behaves the same way.
- Since 2026-08-04 the map sidebar carries a notice naming the dimensions a
  round has no interpretation for, so a partial map is visible without opening
  the dimension that is missing. It also says which cause left each dimension
  without words: the gap carries `generationProvenance.unavailableReason`, and
  the notice and the dimension screen give different advice for the two — retry
  in a few minutes for a silent provider, retry for a different wording when
  this service refused its own copy. Rounds analysed before 2026-08-04 carry no
  reason and get a sentence that claims neither.
- Since 2026-08-05 the metric narratives are covered too:
  `generationProvenance.metricInsightsOutcome` says whether the model or this
  service wrote them, separately from the overview, and the metrics screen says
  so in Hebrew when they are derived. One value per dimension, because one call
  writes all of its narratives. The operational half is
  `ai_deterministic_metric_narrative_ratio_sample`, and a round that recorded
  nothing emits no sample rather than counting as model-written — **read it
  beside the summary ratio, not instead of it**: a key that answers the short
  prompt and times out on the longer one shows a healthy summary ratio and
  derived narratives underneath.
- The same slice documented `unavailableReason` and the `unavailable` outcome in
  `docs/openapi.yaml`, which the partial-map work put on the wire and never
  wrote down. `public/openapi.json` was regenerated.

## Operational invariants

- Confirm the database/environment before any write so work does not land on
  the wrong target. Clear, reseed, reset and migrations need no data-preservation
  ritual during the design stage.
- Keep respondent identity and sub-threshold details out of every manager and
  AI boundary.
- Deployed manager auth requires `SESSION_SECRET`,
  `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`; machine boundaries use
  their own shared secrets.
- The deployed producer switch is configuration, not a silent fallback.
  Unknown contract versions fail closed.
- Parallel agents use separate branches, worktrees and active task files.

## External blockers and approval gates

- Before the first real respondents, rotate the four credentials previously
  exposed in a private design-stage transcript. This is an accepted deferred
  gate, not a blocker for local/docs work.
- Explicit bounded approval is required before changing secrets, credentials,
  authentication configuration or deployment aliases.
- **Closed 2026-08-17: the respondent consent wording is approved.** The second
  promise on the consent screen — that the time the questionnaire is on screen
  is measured and stored with the answers, and that no per-question timing is
  collected — is the owner's, as of 2026-08-17. What stays open is not the
  wording but what it commits the product to: the per-question half describes
  what is *collected*, not what is shown, so any later feature that measures per
  step re-opens this sentence rather than merely extending a schema. It is in
  `src/components/survey/survey-consent-step.tsx`, tested in
  `src/components/survey/__tests__/consent-promises.test.tsx`.
- **Closed 2026-08-17: both of the stack's migrations are applied to the
  deployed database.** `prisma migrate deploy` against the Supabase host
  reported both applied, and the schema was then read back directly:
  `survey_responses.visible_seconds` exists as a nullable integer,
  `survey_responses_visible_seconds_check` holds the `NULL or 1..43200` range,
  and `ai_analysis_runs_trigger_check` now reads
  `trigger = ANY (ARRAY['automatic', 'manual', 'closure'])`. They were applied
  **before** the code landed on `main`, because both are additive — one widens a
  check, one adds a nullable column — so the older code was never running
  against a schema it did not expect. Keep the ordering as the pattern; what
  follows is the reasoning, kept because it says what each failure would have
  looked like.
  Both were applied locally first and both were still absent from the deployed
  database when this stack was assembled. The deploy build runs
  `prisma generate` and never `migrate deploy`, which is the pattern the
  2026-08-10 entry below warns about, and neither of these would be silent.
  `20260817120000_analysis_may_be_triggered_by_closing_a_round` widens the
  `ai_analysis_runs` trigger check to accept `closure`; the deployed database
  was read on 2026-08-17 and still carried
  `CHECK ((trigger = ANY (ARRAY['automatic'::text, 'manual'::text])))`, so
  closing a round would fail the constraint and the PATCH would report
  `analysis: "not_dispatched"` while still closing the round.
  `20260817170000_a_response_may_carry_its_visible_seconds` adds
  `survey_responses.visible_seconds`; without it a respondent's submission fails
  on the missing column, which is the one write the product cannot afford to
  lose. Both are additive — one widens a check, one adds a nullable column — so
  applying them ahead of the code is safe and is the order this stack used.
  This bullet replaces "no open migration decision remains in the repository
  record", which was true when it was written and was not so on 2026-08-17.
- **Closed 2026-08-10, no longer waiting.** `20260810101610_add_survey_attempts`
  creates `survey_attempts` and was applied to the deployed database on
  2026-08-10, right after `bf02dd1` landed on `main`; `prisma migrate status`
  against that host then reported all twelve migrations applied. Worth keeping
  as the pattern rather than as an open item: the deploy build runs
  `prisma generate` and never `migrate deploy`, so every future migration has to
  be applied by hand or the code ships against a schema that lacks it. Here that
  would have been silent — the beacon endpoint swallows its own errors by design,
  so a respondent would have seen nothing and the funnel panel would have read
  zero for every stage.
- **Closed 2026-08-05, no longer a blocker.** The eval corpus has scored real
  provider output. The owner installed a paid Gemini key, and a full run on
  `gemini-3.5-flash-lite` produced `outcome: "llm"` on 55 of 56 stones with no
  `429` in the log. The quota argument for the free tier no longer applies —
  which is why `render.yaml` now paces the fast model at `60` and the heavy one
  at `30`, the rates those runs actually sustained, instead of the `14` and `4`
  the free tier dictated. Applied on 2026-08-05: the service is blueprint
  managed, and its dashboard now reads `60` and `30`. It assumes the dashboard's
  `GEMINI_API_KEY` is the billed key, which no agent can read — the one thing
  about this pace still taken on trust.
  The model in that run is no longer the fast tier: on 2026-08-09 a real round
  through the real chain caught `gemini-3.5-flash-lite` splicing Arabic letters
  into Hebrew words, which these eight synthetic rounds had not. Read the
  55-of-56 as true of that corpus on that day, not as a verdict on the model —
  the pace it justified is unaffected, and the header above has the rest.
  What the first report says lives in
  `docs/agent-tasks/archive/test--eval-corpus-baseline.md`. The open question it
  raised — whether `summary_grounding` counts what it claims to count — was
  answered no and fixed the same day; the baseline is the corrected scoring of
  the same payloads. `no_overreach`, the one weak grader, was then worked on in
  `fix/prompt-no-overreach` and stands at 0.94 with a second baseline beside
  the first. Four asserted causes survive it. **Owner decision 2026-08-05: they
  stay.** The runtime refusal that removes them was built and measured, and the
  measurement decided it — see the entry below. This is settled, not open.
  Still run the provenance check before reading any report, per
  `evals/README.md`.
- That chain has landed. `test/eval-corpus-baseline`, `fix/prompt-no-overreach`,
  `feat/retry-carries-a-critique` and `feat/adaptation-retry-critique` are all
  contained in `main`; the retry that carries a critique is `f8c08a5`. Nothing
  from that work is waiting to be pushed.
- `fix/refuse-asserted-causes` is deliberately **not** in that chain, and owner
  decision 2026-08-05 closed the question rather than deferring it: the rule is
  not merged. It refused asserted causes at runtime, which worked and cost 8 to
  14 percent of the map's model-written prose, and eight of its eleven refusals
  were the model's own caveats about the sample. The code stays on the branch as
  the measurement. Do not re-open it as an unfinished task; the one thing that
  branch carried and `main` needed — the retry that rebuilds its request with a
  critique — landed separately as `f8c08a5`, so nothing there is waiting. If the
  rule is ever revisited, the branch's own note says fix the subject rather than
  the mechanism: refuse a cause attributed to the school or to people, allow one
  attributed to the data and the sample.
- **Settled 2026-08-05, no longer a gate.** The two amendments published
  contract `6.0` took on 2026-08-04 — `supportsPartialMaps` and
  `generationProvenance.unavailableReason` — stood against ADR-002's rule that
  released semantics do not change. Owner decision: ADR-002 gains the explicit
  clause rather than `7.0` being opened. A published contract may gain an
  optional additive field and nothing else, on five conditions ADR-002 now
  states, of which the load-bearing two are that absence keeps the version's
  previous meaning and that the consumer accepts before the producer emits.
  Both amendments meet them. The rule rests on validation that checks known
  fields without enumerating keys, so a validator that ever starts rejecting
  unknown keys revokes it. `docs/ai-contract-version-matrix.md` carries the
  operational form under "Amending a published version".

## What is open, and what it waits on

Recorded at the 2026-08-05 session close and refreshed on 2026-08-06. Nothing
here is unfinished work; each item waits on a decision, a request or the
owner's own hands.

**Waits on an owner decision**

- **Whose name belongs on the copyright line, 2026-08-18.** Open decision 7 of
  the strategy sweep — *public repository with no licence, deliberate?* — was
  answered that day: deliberate, all rights reserved, and `NOTICE` at the root
  now says so, with `README.md` pointing at it and `"license": "UNLICENSED"` in
  `package.json`. It is on `main` and therefore public, which is what makes the
  remaining line worth tracking here rather than in an archived task file. The
  notice reads `Copyright (c) 2026 Maxim Berenshtein`, taken from the Git author
  of 692 of 806 commits, and 88 commits between 2026-06-16 and 2026-07-25 were
  authored from a `zoominfo.com` address — the same person and the same
  `user.name` under a `user.email` inherited from another machine, which
  `.mailmap` now reports as one contributor without rewriting anything. Whether
  personal ownership is the correct claim depends on an employment agreement no
  agent can read. It is a one-line change, and it is now a one-line change to a
  public file.

- **Both goal questions are closed, 2026-08-09, both as "no".** A tracked goal
  gains no owner, no due date and no plan of steps — the three-state goal stays
  the whole of it, because the fields would make this task management rather
  than measurement, and a form is easy to add later and hard to withdraw. And no
  number is shown beside a goal: a dimension's delta is not the goal's result,
  so putting one there would assert through layout the causal link the AI copy
  is already forbidden to assert. The reasoning is in
  `docs/product-behaviour-backlog.md` §5; neither is unfinished work.
- **Seven decisions from the 2026-08-10 strategy sweep**, in
  `docs/product-strategy-axes-2026-08-10.md`. One of the two that gated the most
  other work — whether the three-colour *answer scale* may become 5–6 points
  with the map kept as a derived presentation band — **was answered yes on
  2026-08-14**, by the decision to adopt the research instrument; see the entry
  below. What still gates is whether a pilot school can be named with a date.
  The same document restates the credential rotation below as due before the
  first real respondent rather than after it.
- **The item-to-dimension mapping for the new default instrument, 2026-08-14.**
  Owner decision that day made a 126-item research questionnaire the default
  (`docs/default-research-instrument-plan-2026-08-14.md`), and the methodologist
  owns the table saying which of the eight wellbeing dimensions each of its 108
  Likert items belongs to, plus which items are reverse-scored. It cannot be
  derived from the document or the code, and it is the same question as the
  undocumented dimension-to-framework bridge below. It blocks plan phases 3 and
  5; phases 1, 2 and 4 can be built and verified without it, and phases 1 and 2
  now have been.
- **Whether attention-check items belong in the instrument at all, 2026-08-17.**
  Added as question 6 of `docs/methodologist-questions-2026-08-15-ru.md` and its
  Hebrew twin, and it is the whole of task E in the response-quality plan. Two
  things about it are already settled and the question says so out loud, so that
  a positive answer cannot be read as reopening them. Exclusion is closed on
  differencing grounds and no answer here changes that — `PROJECT_CONTEXT.md`
  ADR-022 carries the correction, because the plan claimed a positive answer
  would make exclusion defensible. And trap items can only enter a **new** round:
  `src/app/api/rounds/[roundId]/survey-definition/route.ts` refuses any question
  change once a round holds one response, and `hasSameQuestionSnapshot` compares
  `polarity` and `scaleId`. "Not worth it for this population" is a full answer
  and closes the item. Nothing is built against it, deliberately — the item text
  is the whole of the feature, and there is none.
- The twelve decisions in
  `docs/scientific-evidence-layer-research-2026-08-09.md` section 5, of which
  1–3 select between three different projects, plus the undocumented bridge
  between the eight dimensions and any published framework — a question for the
  named research adviser rather than for engineering.

**Waits on being requested**

- A second manager per school (§8). One manager per deployment is the requested
  shape; the work behind a second one is a data model and a set of flows, and
  `PROJECT_CONTEXT.md` ADR-013 says why swapping the password hash closes
  nothing.
- Repeat-measurement reminders (§11). Reminding respondents would need contact
  data the privacy model deliberately does not hold; reminding the manager would
  not.

**Waits on the owner's hands**

- Signing in, whenever the UptimeRobot dashboard needs reading. Done on
  2026-08-08; the figures are in the keep-alive section above.
- Signing in, whenever a manager screen needs looking at. The agent never sees
  or types the manager password, so every walk starts with the owner signing
  in — and it has to be in a browser the agent can drive. On 2026-08-06 the
  first attempt was lost because the sign-in happened in a window that was not
  connected; the connected Chrome is the one to use. The preview pane is a
  separate browser with its own cookies.
- **Done 2026-08-11, and it found something.** The three screens only ever
  walked locally — the builder's version history, an archived round's read-only
  round screen and `מעקב יעדים` — plus the round switcher were walked signed in
  on the deployed endpoint, and all four render and behave as documented. The
  deployed database was empty, so the walk built a school, two rounds, twelve
  responses and one real analysis run to have anything to look at; that test
  data was deleted the same day with `scripts/clear-test-data.ts` and the
  database is empty again. The walk also spent an hour on a `/dashboard/` whose
  AI panel never left its loading spinner, and **that did not survive a
  reproduction attempt**: on a rebuilt round the deployed dashboard served all
  four analysis states correctly — run in flight, run failed with its retry
  card, builder-saved questionnaire, insights stored. Recorded as a transient
  fault, not a defect, and the reading that fits it is a request that never
  completed rather than one that never fired. Details and evidence:
  `docs/agent-tasks/archive/test--deployed-signed-in-walk-2026-08-11.md`,
  archived on 2026-08-11 when the branch landed.
- **Creating the UptimeRobot monitor for `GET /api/v1/fallback-status`**, once
  that endpoint is deployed. A keyword monitor matching `degraded`, alongside the
  provider one that matches `failing` — two monitors, two paths, deliberately not
  one body. Nothing in this repository can create it and nothing in it can prove
  it exists; the code side is done and pins its own three literals, so the whole
  of what remains is a form in a dashboard. Until it is filled in, the ratio is
  readable and still unwatched, which is the state this work exists to end.
- **Reading the manager guide, in any of its three languages.** `/help` and the
  floating badge are on `main` and deployed, and no native reader of Hebrew,
  Russian or English has read the copy. Hebrew is the original and the other two
  are translated from it, so a correction is made in
  `src/lib/help/topics/he.ts` first and brought across; every figure the guide
  shows is computed from the module that enforces it and cannot be edited in a
  translation. What needs eyes is the wording, not the numbers.
- Rotating the four design-stage credentials before the first real respondents.
  Listed above as an accepted deferred gate; it is still open.

**Worth a look, cheap**

- **Seen 2026-08-11.** The round switcher renders on the deployed endpoint with
  two rounds, labels each with its status, and choosing one rebuilds the screen
  for it. Nothing left to look at here.
- The doubt this list carried since 2026-08-05 — that two minutes of `Up` says
  nothing about a quiet night — is **answered, and the answer is 99.869% with
  one 5m 5s timeout at 05:01 on 2026-08-07**. Both readings are in the
  keep-alive section. Nothing here is left to look at; the next thing that would
  add information is whether a second night passes without an incident.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

**Core was last read in the Vercel dashboard on 2026-08-10 and was `568fbcb`,
`Ready`, Production, built in 40s** — `origin/main` at that moment. **That
reading is now two sessions behind the repository:** 2026-08-11 pushed six
product commits and their task-file archives, 2026-08-13 pushed two more and
theirs, and `origin/main` has moved twice. The 2026-08-13 session could not
even repeat the anonymous health reading: outbound requests to the deployment
fail to connect from that container. Vercel builds every
push to `main`, so the deployed build is expected to be the tip, but the
deployments list was not re-read on 2026-08-11 — that needs the owner's
signed-in Chrome, and nothing this session depended on it. Anonymously on
2026-08-11, `https://shalomut-map-demo.vercel.app/api/health/` answered
`status: ok` with producer `6.0`; none of the day's changes is reachable from a
public page, so that is a liveness reading and not a content one. The header of
this file says what that does and does not prove for each of the four items.
The detail below is the 2026-08-06 reading of `9983184` and is kept for what it
exercised, not as the current deployed commit:

- **Core (Vercel):** the newest deployment is `9983184` on `main`, environment
  `Production`, status `Ready`, built in 39s about a minute after the push, and
  carrying the current production badge.
  Read from the project's deployments list in the owner's own signed-in
  Chrome; nothing was clicked and no secret was displayed. Anonymously, `/`
  still answers `307` to `/login`, as it should. Signed in, the deployed home
  and tracking screens serve the new code: the round-scoped links carry
  `?round=`, `setup` and `goals` stay bare, and the console is clean. The
  switcher does not render there, which is correct — the deployed school has
  one round, and the switcher appears from two.
- **Python (Render): re-read on 2026-08-08 and on `a968dcd`**, the current
  `origin/main`. `/health` answered `status: online`, `commit: a968dcd`,
  `env: production`, `privacyThreshold: 10`, `supportedContractVersions`
  `1.0`–`6.0`, `jobPollingEnabled: true`. The service rebuilt on every push to
  `main` when this was read, so it reported the repository tip even when the
  commit — as here — changed only documentation. That stopped being true on
  2026-08-09, when `render.yaml` gained a `buildFilter`; see the keep-alive
  section above before reading a `commit` against the tip. The previous reading
  was `763e38f` on 2026-08-05; no Python source changed in between.
- The schema matches: the only migration these three slices needed was applied
  by hand on 2026-08-05, and nothing after it changed a schema.

Earlier readings the same day — `143d460` at 17:10Z, `3590aae` at 14:31Z,
`65b2885` and `67048b5` before them — were trimmed on 2026-08-05 along with the
snapshot chain above. Each said the same thing about a commit that is no longer
deployed, and Git holds the commits themselves.

So the contract amendment of 2026-08-05 is live on both sides. What that is
**not** evidence of: no round has produced `metricInsightsOutcome` against a
real provider yet. Deployed code, not deployed behaviour.

`GET /api/health` on Core **is public now** — cheap-win item 7 put it in the
middleware bypass — so the deployed producer and supported versions can be read
without signing in, and were on 2026-08-11. The sentence this paragraph used to
carry, that reading them meant an owner sign-in, stopped being true when that
landed.

**The functional half of this check is done, 2026-08-04.** It had stood open
because every manager route redirects to `/login`. The owner signed in
themselves in their own Chrome and handed the session over; the agent never saw
or typed the credentials, and that remains the rule.

What was exercised on `shalomut-map-demo.vercel.app`, signed in:

- Setup, builder, round tracking and the dashboard all render real persisted
  data. The stone map is unlocked at ten responses against a threshold of ten,
  with all eight dimensions, statuses carried by words as well as colour, and no
  respondent-level detail anywhere.
- The persisted save time end to end: saving on the setup screen showed
  "נשמר בשעה 14:43", a full reload kept it — server-rendered from the column,
  not tab state — and the builder showed the same time, because both screens
  read one `updated_at`.
- The round's `updated_at` was then set back to `NULL` so the deployed data is
  as it was, and both screens correctly went back to showing no save time. The
  round itself was rewritten only with the values it already held.

This is behaviour, not deployment metadata. What still needs the owner is the
sign-in itself, so plan a deployed functional check as something done together.

That check is a day old and already behind: it predates the questionnaire
version history, the read-only archive and the school-wide goals screen, none of
which any human has opened in a browser. They are covered by rendering and route
tests, which is not the same claim.

The long-term identity model is no longer the next architecture slice. Owner
decision 2026-08-03: one manager per deployment is the requested product shape,
so identity is requirement-gated future work — `PROJECT_CONTEXT.md` ADR-013 and
`docs/product-behaviour-backlog.md` §8. The SHA-256 password hash stays as it
is; it is derived from `MANAGER_ADMIN_PASSWORD` per login and never stored, so
replacing the algorithm alone would close nothing.

What this leaves standing as an operational item: the deployment secret is the
credential, so rotating it means a redeploy, and the open rotation of the
exposed design-stage credentials before the first real respondents is
unaffected by this decision.
