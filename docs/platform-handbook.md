# How the platform works, in plain language

Living document, and the **source text** for every translated snapshot of it.
Written for someone who has to understand what the product does without reading
the code: a school partner, a methodologist, a new team member, an owner
deciding what to build next.

Two rules govern this file.

- **Plain language is the point, not a style preference.** Its readers do not
  know what a lease, a contract version or a durable job is, and do not need to.
  Where a mechanism has a technical name, the name is in the glossary at the end
  so the reader can say it to a developer — not in the body.
- **This file is the original; `snapshots/` holds translations.** A change
  belongs here first. See [`snapshots/README.md`](snapshots/README.md) for how a
  translated copy is released and why it is dated rather than synchronised.

Where this text and the product disagree, the product is right and this text is
what gets fixed. Deeper detail lives in the documents this one links to;
architecture decisions live in [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md),
and the mechanics of one analysis run are drawn in
[`ai-analysis-run-lifecycle.md`](ai-analysis-run-lifecycle.md).

## 1. What the product does

A school wants to understand how its teaching staff is doing. Not as one
satisfaction number, but across several sides of working life at once. Teachers
answer a questionnaire anonymously, and the principal receives not a table but a
**map of eight stones** — one per side of wellbeing. Each stone carries a colour,
and beside it sits text: what this means, and what to do about it.

The stone metaphor is deliberate. Wellbeing is not a rigid score but something
that shifts and settles differently; stones lie unevenly and look alive, where a
grid of cards looks like a report.

### The eight sides

| Side | Hebrew | What it is about |
| --- | --- | --- |
| Self-expression | ביטוי עצמי | room to be yourself and speak in your own voice |
| Professional competence | מסוגלות מקצועית | the sense of being able to do what is asked |
| Social resources | קשרים חברתיים | relationships with colleagues, having your people nearby |
| Balance | איזון | how work sits against the rest of life |
| Management support | עורף מקצועי | backing from school leadership |
| Certainty | ודאות | how clear the rules, the plans and tomorrow are |
| Organizational climate | אקלים ארגוני | the atmosphere in the school |
| Meaning | משמעות | the sense that the work matters |

The eight are fixed. A school may write its own questions, but not its own
dimensions — see §4.

### The three colours

| Colour | Score | How it is presented |
| --- | --- | --- |
| Green | 75 and above | a strength to preserve; actions that maintain it, not improve it |
| Yellow | 50 to 74 | an area that needs attention |
| Red | below 50 | an area that needs care — never named as a failure |

Green behaving differently from the other two is a product decision, not a
wording choice: a green dimension leads to `פעולות לשימור`, maintenance actions,
rather than to improvement goals.

**Colour is never the only carrier of meaning.** Every colour is accompanied by
a status in words, so a reader who does not distinguish colours, or is looking at
a phone in sunlight, loses nothing.

## 2. Who takes part

Three kinds of people, four machines. The split between the machines is not a
technical preference: it is what makes the promise of anonymity keepable.

```mermaid
flowchart LR
    T["Teacher<br/>answers via a link"] --> C
    U["School user<br/>shares the link and reads"] --> C
    P["Platform administrator<br/>sets up and closes rounds"] --> C
    C["Shalomut site<br/>stores and calculates"] --> DB[("Database<br/>answers, rounds, questionnaires")]
    C -.->|averages only| A["Analysis service<br/>writes the text"]
    A -.->|the same anonymous set| G["Gemini model<br/>chooses the words"]
    A -.->|finished text| C
```

Dotted arrows are the boundaries that data about an individual does not cross.
Solid ones stay inside the school.

| Who | What they do |
| --- | --- |
| **Teacher** | Opens an anonymous link, answers, leaves. No registration, no name, no e-mail. The system does not know who it was. |
| **School user** — the principal or wellbeing coordinator | Shares the anonymous link, watches how many have answered, and reads the map, the group breakdown and how the round was filled in. Nothing else: since 2026-08-23 every action on a round is an administrator's. |
| **Platform administrator** | Everything else: sets up a round, including its privacy threshold and the school's background details, builds the questionnaire, activates, closes, archives and resets rounds, orders a re-analysis, records school goals and reads the activity log. |
| **The site** | The main part. Stores everything, calculates everything, decides what may be shown, renders the screens. The only party that sees answers. |
| **The analysis service** | A separate program with its own life. Receives averages only and returns Hebrew text. Never sees an answer. |

**Why analysis is a separate service.** If the text were written inside the
site, one program would hold both individual answers and a connection to an
external model. Separating them makes a leak not a matter of care but a
structural impossibility: the analysis service has nothing to leak, because it
never holds one person's answers.

## 3. The life of one round

A round is one measurement: one questionnaire, one collection period, one
result. A school runs two to four a year and deletes none — past rounds stay as
the history a new one is measured against.

```mermaid
flowchart TD
    S["Draft<br/>the administrator describes the round"] --> Q["Questionnaire builder<br/>questions across the eight sides"]
    Q --> V{"All eight sides<br/>covered by a question?"}
    V -->|no| Q
    V -->|yes| A["Round is active<br/>a link for teachers appears"]
    A --> R["Teachers answer<br/>anonymously, once each"]
    R --> Cl["The administrator closes collection"]
    Cl --> P{"Enough answers<br/>to meet the threshold?"}
    P -->|no| L["Result stays locked<br/>the screen explains why"]
    P -->|yes| An["An analysis order<br/>enters the queue"]
    An --> Map["A map of eight stones<br/>with text and recommendations"]
    Map --> G["The administrator records<br/>recommendations as school goals"]
    Map --> Ar["Later the round is archived<br/>but keeps its own address"]
```

Five rules govern that path.

- **A school has exactly one active round at a time.** Activating a new one
  closes the previous one and orders its analysis. Otherwise two live links would
  circulate in one staff room, and nobody — the system included — could say
  which measurement a respondent was answering.
- **Closing collection is what orders the analysis, not each answer.** While a
  round is open its screens show how many have answered and no numbers at all:
  a round publishes its figures once, when collection closes, and the analysis
  is written from those. The administrator's "analyse again" button refuses a
  round that is not closed: it is a second opinion, not the first.
- **One filling, one questionnaire.** The teacher's browser holds a random label
  for the duration of filling; sending the same filling again does not create a
  second questionnaire. The label is tied to neither a person nor a device, and
  is cleared between people at a shared computer — so a new filling after a
  finished one is a new response, because an anonymous link has nobody to
  recognise.
- **Archiving only removes a round from the list.** An archived round keeps its
  page, its map and its place in comparisons. It can no longer be changed — a
  deliberate point of no return, which is why the product asks for confirmation.
- **A reset erases the measurement, not the round.** The administrator can reset
  a round that is not archived: its answers, analyses, analysis orders and goals
  are deleted together, and the round goes back to editing. The questionnaire's
  history stays.

## 4. The questionnaire and its versions

Questions are not baked into the product. Each school may ask its own, in its
own words and its own number. One requirement stands: every scored question must
belong to one of the eight sides, and all eight must be covered by at least one
question. Until that holds, the round stays a draft and issues no link.

The default offered is the **research instrument**: 126 items — sixteen
background questions, two grids where a day's time and a day's load are each
split into 100 percent, and 108 statements in thirteen blocks answered on
five- or seven-point scales, some of them reverse-scored. Thirty of the
statements are collected and never scored. It is a starting point, not an
allowlist; the original 24 three-colour statements survive as the legacy
questionnaire of rounds created before it.

| Kind of question | What it does |
| --- | --- |
| **Scored** | Produces a number, enters the average for its side, and ends up colouring a stone. These are the ones that must cover all eight sides. |
| **Background** | Age, tenure, role, workload. Scores nothing and moves no stone. Exists so the picture can be read by group — and lives under its own, stricter privacy rules (§6). |

**A questionnaire cannot be rewritten mid-collection.** Once the first answer
arrives, this round's questions freeze. The reason is simple: if half the staff
answered one wording and half another, an average over them means nothing.
Changing the questions means starting a new round.

While there are no answers yet, editing is free, and every save that changes
something files a copy of the questionnaire into a history. A copy can be loaded
back into the editor and saved as an ordinary edit — so a "revert" here is just
another save, which is itself versioned and therefore reversible. Twenty copies
per round are kept: a recovery line, not an archive.

## 5. How a stone gets its colour

Nothing clever happens here, and that is the point: arithmetic decides the
colour, not a model. The same number always yields the same colour, and the AI
cannot influence it.

```mermaid
flowchart LR
    A["One teacher's answer<br/>to one question"] --> B["Becomes a number<br/>from 0 to 100"]
    B --> D["Averaged across every answer<br/>to one side's questions"]
    D --> E{"What came out?"}
    E -->|75 and above| G["Green"]
    E -->|50 to 74| Y["Yellow"]
    E -->|below 50| R["Red"]
```

A side is averaged over all the answers to its questions together rather than
as an average of question averages, so every answer counts the same however many
people answered its question.

The 75 and 50 boundaries live in one settings file that both programs read — the
site and the analysis service. Tuning the methodology after the pilot is
therefore an edit in one place, not a hunt for the number 75 across the code.

One subtlety worth knowing: a question can be reversed. A high answer to "I have
enough support" is good; a high answer to "I am constantly behind" is not. The
model of a question can carry that polarity, so 100 always means wellbeing rather
than mere agreement.

## 6. Privacy

Not a setting and not a checkbox, but a property of the product: the thing that
cannot be switched off without breaking what it is for. Teachers answer honestly
exactly as far as they believe their answer cannot be pulled back out.

### The threshold of ten

Below ten answers the result is locked whole. Not shown approximately, not shown
without detail — locked, and the screen says why. Ten is both the default and the
minimum: the administrator may raise a round's threshold, never lower it.

```mermaid
flowchart TD
    S["Collection closed, answers in"] --> A{"Total answers<br/>at least the threshold?"}
    A -->|no| L["Locked whole.<br/>The model is not called at all"]
    A -->|yes| B{"Enough answers<br/>on every single question?"}
    B -->|no| L
    B -->|yes| C["Averages are calculated"]
    C --> D["Only aggregates, the question texts<br/>and the school's details leave the site"]
    D --> E["Text comes back, is checked,<br/>and is shown"]
```

Note the second check: **all or nothing**. If even one question is short of
answers, the whole detailed result closes rather than that one question. Quietly
dropping the inconvenient question and showing the rest would be more
convenient — and would be a way to recover the missing answers by subtraction.

### What leaves the school

| Leaves | Never leaves |
| --- | --- |
| Average scores for the eight sides | Any individual's answers |
| Per-question averages, answer counts and how the answers split across the three colours | Teachers' names, e-mails, addresses — absent from the schema, not merely unused |
| The text of the questions themselves, with each one's scale and whether it is reversed | The filling-session label |
| The school's background entered at setup — pupils, classes, new staff, sick days, a socio-economic index, notes | Any background answer: age, tenure, role, salary band |

Demographics do not reach the model at all. The map's reader does not need them,
and an external service would then hold a profile of a named school's staff. The
people who sign in are the one exception to "no names": the name and e-mail
address of a school user or an administrator are stored for sign-in and the
activity log, and never reach the analysis service.

### A separate guarantee for group breakdowns

The threshold of ten protects a *total* and says nothing about a single *cell* of
a table. "Teachers aged 51–60 in the special-needs track" can be one person
inside a perfectly healthy round of eighty. Group tables therefore carry their
own rule:

- no cell below the threshold is published;
- no suppressed cell can be recovered by subtraction — every row and every column
  either holds no suppressed cells at all or at least two, because one blank
  beside a published total is a subtraction, not a blank;
- the grand total stays published: it is the round's answer count, which every
  manager screen already shows.

### Why answers are never excluded

The temptation is understandable: drop the people who filled the questionnaire in
ninety seconds. The product refuses, and not out of squeamishness. The moment one
round has two different bases — "everyone" and "everyone except a few" — the
difference between the two published pictures *is* those people's answers,
recoverable by subtraction almost exactly.

So a round always has exactly one basis of calculation. The school does see
*how* the round was filled — how many questionnaires came back faster than the
instrument can be read — and may act at the level of the round: extend
collection, reword the invitation, ask the staff room again. There is no button
that removes a respondent, and there will not be one. The full argument, including
why an unbiased selection criterion would leak exactly as much as a biased one,
is ADR-022 in [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).

## 7. How an analysis is ordered

Analysing one round is several minutes of work and nearly twenty calls to a
language model, more with retries. Anything can happen in that time: the
service is restarted, it falls asleep, the network blinks. So the order is not
handed from one party to another — it is **placed on a job board** and lives in
the database until somebody completes it.

```mermaid
sequenceDiagram
    actor U as School user
    actor A as Administrator
    participant S as The site
    participant B as Job board
    participant W as Analysis service

    A->>S: I am closing collection
    S->>B: Places an analysis order
    Note over B: the order waits,<br/>even with no worker alive

    loop every couple of seconds
        W->>B: Any work?
    end

    B-->>W: The order is yours, ticket for 90 seconds
    W->>S: Give me the round's averages
    S-->>W: Averages only, no answers

    loop while writing the text
        W->>B: Still working, extend the ticket
    end

    W->>S: Finished text and recommendations
    S->>S: Checks the numbers match the published ones
    S->>B: Order complete
    U->>S: Opens the map
```

**What the ticket is for.** A ticket is a temporary right to one order, lasting
ninety seconds. While the worker is alive it says so every half minute and the
ticket is extended; a "still here" lost on the way is repeated rather than taken
as the end. If it goes quiet — asleep, crashed, restarted — the ticket
simply expires and the order becomes free again. Nobody has to notice a worker's
death and repair anything by hand: silence is the signal.

The other half of the same mechanism: a worker that wakes up to find its ticket
taken **has no right to write the result**. It learns this at its next attempt to
extend the ticket, at most half a minute later, and stops quietly. Two copies of
one analysis never compete for one map.

- **One round, one order in flight.** A double click or two simultaneous
  requests for a round collapse into a single order rather than two bills from
  the model. Different rounds are analysed side by side, several at once.
- **Three attempts, then stop.** An order handed out three times and never
  completed is marked failed and left as it is. There is no endless automatic
  retry: each attempt costs nearly twenty model calls, and failures of this kind
  do not pass by repeating them.
- **A failed order is kept, not cleared.** It is the evidence of what happened.
  Asking again is a deliberate act by the administrator, and only a reset of the
  round (§3) removes the order, together with everything else it measured.

**And somebody watches the board itself.** Every mechanism above assumes there
is a worker coming. If there is not — the service died, or was never woken —
the orders simply sit there, because the thing that tidies up abandoned orders
is the same worker that stopped coming. So the board answers one more question
out loud: is anybody taking the work? It is not a queue-length alarm, which
would go off on any busy afternoon; it is the combination of work that has
waited too long *and* nobody currently holding a ticket. A monitor can read that
answer without a password, and it reads as a failure the moment it is one.

**And the manager's screen waits instead of the manager.** Everything above is
about the order reaching a worker. The last stretch is the person who ordered
it, and until now that stretch was theirs to walk: the screen said the results
would appear in a few minutes and offered a button, so the one thing a manager
cannot do — know when three minutes are up — was the thing being asked of them.
Now, while a run is in flight, the screen looks again on its own: soon at first,
then less often, and not at all while the tab is hidden, because a tab nobody is
looking at is not waiting. When the map lands it says so in a sentence, on the
screen where the change happened. And it stops after about twenty minutes and
admits it stopped, because a page that promised to keep watching forever would
be lying the moment the queue really was stuck — which is the case the board's
own alarm above is for. Nothing reaches a tab that is closed: there is no e-mail
and no push, and none is planned.

The same mechanics with real endpoint names, status codes and constants are in
[`ai-analysis-run-lifecycle.md`](ai-analysis-run-lifecycle.md).

## 8. What the AI writes

The division of labour is strict: **the site calculates numbers and colours, the
model writes words**. The model cannot change a score, recolour a stone or move a
boundary. It receives an already-calculated picture and explains it in Hebrew.

What happens inside one analysis:

1. **Privacy check.** First, before a single call to the model. If the round is
   locked by threshold, work ends here and no paid request is spent.
2. **Interpretation.** For each of the eight sides, connected text: what this
   state means in this school.
3. **Choosing recommendations.** Taken not from the model's head but from a
   catalog of interventions written by people, scoped strictly to the side.
4. **Adapting the wording.** The chosen recommendation is rewritten for this
   round so it does not read like an extract from a manual.
5. **Safety validation.** What was written is checked: the right language, no
   causes asserted that the numbers do not support, no claims about people.
   Parts that fail are rewritten — up to three times, and only the rejected parts
   are replayed, not the whole round.

### Honesty where the text is not the model's

Sometimes the model does not answer, or answers in a way validation will not
pass. Rather than a blank, text assembled by the program itself may appear — it
restates the status and the distribution of answers and names no cause at all.
And the screen says in Hebrew that those paragraphs were not written by the AI.

This rule has no exceptions: text the service wrote may be shown, but may not be
presented as the model's. The note is set separately on a side's overview, on
the round's overall summary and on the wording of the recommendations, so the
case where the model wrote one of them and not another is visible too.

If repair fails entirely, the product would rather show an **honest gap** in the
sides that could not be written than lose the round: the school still receives
every side that was, with an explanation standing where the missing ones would
be. But if no side was written at all, or the overall conclusion or a
recommendation could not be, the round fails as a whole — a map with nothing
written in it is a failure wearing the shape of a map.

### Recommendations and school goals

The administrator can turn a recommendation into a **school goal** and moved through selected
→ in progress → done. A goal is a *copy* of the text at the moment of the
decision, not a reference to it. So the next analysis, rewriting every
recommendation, does not erase a decision the school already made: the goal stays
on screen, marked as chosen from an earlier analysis.

A goal has no owner, no due date and no plan of steps — deliberately, because
those would turn measurement into task management. And no number is shown beside
a goal: a stone's change is not that goal's result, and placing the two together
would assert through layout the causal link the AI is forbidden to assert in
words.

## 9. When something breaks

The governing principle: **a failure announces itself rather than impersonating a
result**. No screen shows invented text standing in for a model that did not
answer.

| What happened | What the screen shows | What happens inside |
| --- | --- | --- |
| Model unavailable or quota exhausted | The map, with a Hebrew note on every text the program wrote instead of the AI | The order completes: the missing text is assembled from the numbers and marked, and the share of such text is recorded |
| The analysis failed for another reason | A Hebrew sentence: analysis is unavailable right now, try again in a few minutes | The order is marked failed with the precise reason; raw errors never reach the screen |
| An analysis ordered again failed | The previous map stays, with a note that it was not updated | The failed order is kept; the earlier result is still the latest completed one |
| The analysis service slept or restarted | An open screen keeps waiting and says when the map arrives | The ticket expires, the order returns to the queue, the next worker takes it; if nobody does, that is visible from outside without a password |
| Returned text does not match the numbers | No analysis appears; the administrator can ask again | The site compares the text with the figures the round published when it closed; a mismatch is rejected whole |
| The reply was lost in transit | Nothing — the result is saved, or arrives later | Delivery is attempted up to four times, and the same result arriving twice is recognised as the same one; if every attempt is lost, the order returns to the queue |
| Not enough answers | The screen explains the result is locked for anonymity | No order is created at all and the model is never called |

One thing worth remembering: **the system never retries a failure by itself**.
If an analysis failed, no background mechanism will loop over it; only an order
lost on the way — a sleeping worker, a reply the network swallowed — goes back
to the queue, within the same three attempts. A person asks again — which is
also a protection, because every attempt costs money and because the causes of
most such failures do not change on repetition.

## 10. Where all this lives

There are exactly two environments and no third: **local**, on a developer's
machine, and **deployed**, the one reachable by link. The deployed one is called
production out of habit, but holds no real respondents and no real data yet: this
is the design stage, and the contents of the database are treated as disposable.

| Party | What it does | Where physically |
| --- | --- | --- |
| Vercel | hosts the site; every request passes through it | default region, never chosen |
| Supabase | the database: rounds, questionnaires, answers, results, and the sign-in addresses and activity log of the people who manage schools | Seoul |
| Render | hosts the analysis service | Frankfurt |
| Google | the language model that writes the text, and sign-in for the people who manage schools | region not selected |

**Israel is not in that column.** The school and the teachers are in Israel; the
four companies, in five roles, sit in at least three other jurisdictions. This is
known and recorded — the Seoul database is the most visible part, and one query
to it costs noticeably more time than it would to a nearer neighbour. It has to
be revisited before the first real respondents, together with rotating the
service keys exposed during design. Sign-in to the deployed site already goes
through a Google account, and the product stores no passwords. The full account
of who receives what is
[`data-flow-and-subprocessors.md`](data-flow-and-subprocessors.md).

One more property of the deployed environment worth knowing in advance: the
analysis service runs on a free plan and falls asleep without inbound traffic. A
sleeping service is not a slow service — it is one that takes no orders off the
board at all, because its own polling is outbound and does not count. So it is
woken from outside: an external free monitor knocks on its health address every
five minutes.

## 11. Rules that do not bend

The short list of what may not be worked around, for convenience or for a nicer
screen. If one of these stops holding, that is not a small bug — it is the
product broken.

1. **Nothing detailed is shown below the threshold.** Not on any screen, not to
   the model, not in a group breakdown.
2. **An individual answer and an identity never leave the site.** Only averages
   go out.
3. **The eight sides and the colour boundaries belong to the site.** The model
   neither chooses nor can change them.
4. **Text written by the program is never presented as the model's.**
5. **Empty persistence stays empty.** With no data the product says there is
   nothing here yet, rather than showing a demo school with invented numbers.
6. **A round has one basis of calculation.** No "the same thing again, but
   without these answers".
7. **Hebrew and right-to-left are the product's native reality**, not a
   translation bolted on afterwards.

## 12. Glossary

Left: how this handbook says it. Right: what a developer calls it.

| In plain language | In the code and in conversation |
| --- | --- |
| The site | Core, the Next.js application |
| The analysis service | AI analytics service, FastAPI |
| A side of wellbeing, a stone | dimension, stone |
| A measurement | round |
| The school user | the `manager` role |
| The platform administrator | the `admin` role |
| The job board, an analysis order | the durable job queue, `AiAnalysisRun` |
| A ticket for 90 seconds | lease, and its `leaseToken` |
| "Still working" | heartbeat, every 30 seconds |
| The threshold of ten | `privacyThreshold` |
| The result is locked for anonymity | privacy locked |
| Averages without personal data | privacy-safe aggregates |
| The agreed exchange format | contract, versions `1.0`–`7.0` |
| Text written by the program, not the model | `deterministic_fallback` |
| An honest gap instead of text | `outcome: unavailable`, partial map |
| The frozen questionnaire of a round | `surveyDefinition`, the question snapshot |
| The filling-session label | `anonymousTokenHash` |
| Hiding small cells in group tables | cell suppression |
