# Evidence cards — prototype and cost measurement, 2026-08-09

> **Status: not for implementation.** This document exists to be discussed with
> the product owner. Nothing here is scheduled, approved or agreed, no code
> follows from it, and the card format below is a probe, not a specification.
> The prototype scripts and card files were deliberately kept outside the
> repository so that nothing reads as a starting implementation.

Companion to
[`scientific-evidence-layer-research-2026-08-09.md`](scientific-evidence-layer-research-2026-08-09.md),
which asked where the pipeline lacks scientific evidence. This one asks the next
question by building the smallest possible thing and running it:

**If we did attach research to the analysis, what would the unit look like, and
what would one unit cost to produce?**

Everything below was executed against the shipped code — the real
`LocalInterventionVectorStore` statistics, the real `hebrew_validation` gates and
the real eval corpus. Nothing is a mockup.

---

## 1. Why a card rather than a document

The retrieval unit in this system today is one Hebrew sentence: catalog summaries
run 43–116 characters, median 61. A journal article is not that. Feeding papers
to a model and asking it to summarise them per round reintroduces exactly the
failure the layer is supposed to prevent — an unverifiable claim, generated
fresh, read by a principal.

A card is the paper reduced, once and offline, to what the runtime actually
needs. The fields below were not designed up front; each one was added because
the prototype failed without it.

```json
{
  "id": "ec-spilt-relationship-representation-01",
  "product_dimension": "meaning",
  "construct": "mental representations of the teacher-student relationship",
  "provenance_tier": 1,
  "read_scope": "Title page, model section and Discussion read in the source PDF. The full 45 pages were NOT read.",
  "signature": {
    "kind": "cross-dimension contrast",
    "novel_signal": "one dimension high while another is low — eight interpretations are written in eight independent calls and nothing compares any two of them",
    "high_dimension_in": ["meaning", "professional-competence"],
    "high_status_in": ["green"],
    "low_dimension_in": ["management-support", "social-resource", "organizational-climate"],
    "low_status_in": ["red"],
    "contrast_min": 30.0
  },
  "finding": "A review building on Lazarus's transactional model. Its central proposition is that teachers' mental representations of their relationships, rather than perceptions of misbehaviour as such, guide the daily stress response. The authors state this as reasoning and frame the paper as directions for future research.",
  "licensed_claims_he": ["…"],
  "forbidden_claims": [
    "that the strong dimension protects against the weak one",
    "that relationships cause wellbeing",
    "presenting a proposed model as an established finding"
  ],
  "limitations": ["theoretical review, not an empirical test", "…"],
  "evidence_strength": "theoretical proposition, untested",
  "source": { "primary": "…", "bridge": "…", "verified_against": "…" }
}
```

Two fields carry more weight than the rest.

**`signature`** is what makes a card runtime-usable rather than decorative: the
pattern that must be visible in the aggregates before the card may be used. It is
matched by ordinary code — no model, no network, no randomness.

**`forbidden_claims`** is what makes a card honest. In practice it did more work
than `finding` did.

---

## 2. What was run

Two rounds of prototyping, six cards, all against the shipped statistics.

### Round one — does a signature discriminate at all?

Three cards built on the **climate strength** construct: within-unit agreement on
climate perceptions, a property distinct from the mean (He et al., 2023;
Schneider et al., 2002). This was chosen because the eval corpus ships a twin
pair — `mixed-middle` and `polarized` — with identical averages and different
spreads.

| round | score | severity | polarization |
| --- | --- | --- | --- |
| `mixed-middle` | 60.0 | 0.500 | **0.040** |
| `polarized` | 60.0 | 0.500 | **1.000** |

The signal is already computable from the shipped code: identical score,
identical severity, polarization differing by a factor of 25. Matching was
diagonal — the split card fired only on `polarized`, the agreed card only on the
agreed rounds, the favourable card only on `uniformly-healthy`.

Honest caveat found in the same run: the "agreed" card fired on both
`mixed-middle` and `uniformly-weak`. It discriminated agreement but not level.

### Round two — three primary sources, read directly

| card | source | fires on |
| --- | --- | --- |
| OECD — concentrated demand | Viac & Fraser (2020) | **never** |
| Spilt — cross-dimension contrast | Spilt et al. (2011) | **once**, on `contradictory` |
| Carroll — co-occurrence | Carroll et al. (2021) | every non-healthy round |

One of three works as intended. Both failures are informative and are the main
finding of this document.

---

## 3. The four things the prototype actually established

### 3.1 A card earns its place only if its signature uses a signal the pipeline does not already act on

The Carroll card keys on "social resource and organizational climate are both
bad". Formally that is a cross-dimension signal; practically it fires on every
round that is not healthy, which is the same as saying "things are not great" —
something the map already says on its own.

The Spilt card keys on "one dimension green while another is red, gap ≥ 30". It
fired exactly once, on the round built to carry that pattern (`meaning` 88,
`management-support` 28). That contrast **cannot be expressed today at all**:
the eight interpretations are written in eight independent provider calls and
nothing compares any two of them.

This is the design rule the exercise produced, and it is a stricter filter than
expected. Most of the literature yields framing, not a catchable signal.

### 3.2 The offline harness cannot test one of the three most promising signal kinds

The OECD card keys on whether damage inside a dimension is concentrated in one
question or spread across all of them. It never fired — because
`evals/corpus.py` gives every question inside a dimension the **same** spread, so
within-dimension severity range is always exactly 0.

The signal is computable from real data; the synthetic corpus simply cannot
express it. Any work on within-dimension patterns needs the corpus extended
first. This is a gap in the test harness, not in the idea.

### 3.3 Automated citation extraction failed twice out of two attempts

Both times the failure was silent and plausible:

- Asked to summarise the climate-strength paper, the extraction returned a
  citation for Schneider et al. with the wrong journal volume, the wrong pages
  and a **wrong title**. The correct reference — *Climate strength: A new
  direction for climate research*, JAP 87(2), 220–229 — was recovered only by
  reading the source PDF's own reference list.
- Asked for the four components of the OECD framework, the extraction returned
  "physical / social / psychological / professional". The source says **physical
  and mental, cognitive, subjective, social**.

Neither error was detectable without opening the file. This is direct evidence
for the rule that ingestion must be human-reviewed, and against any design where
a model reads papers at runtime.

### 3.4 The Hebrew fits, but only if written for the slot

Round one's claims, written to be honest and no longer, came out at 117–143
characters. `is_hebrew_only_copy` accepted them; `is_v6_qualitative_narrative`
refused all three, on **length** — the visible body requires 300–500 characters.
Two of the second batch missed by 8 and 18 characters.

Round two's claims, written deliberately for the slot, came out at 339–377
characters and passed both gates.

So the constraint is real but navigable: a licensed claim has to be authored at
roughly three times the length honesty alone would produce, and the padding is
where unsupported content would otherwise be manufactured. Citations and DOIs are
refused by the Hebrew gate at every tier, as expected — they can only live in a
`source`-like field.

---

## 4. What one card costs

This was the point of the second round.

| | |
| --- | --- |
| Primary sources located and downloaded | 3 (+1 supporting) |
| Pages available | 82 + 45 + one article + 23 ≈ 150+ |
| Pages actually read | targeted sections, ~25–30 |
| Citation errors caught by reading the source | 2 of 2 attempts |
| Cards produced | 3 |
| Cards that genuinely discriminate | **1** |

**Roughly three sources read per card that does real work.** Not because the
sources are poor, but because most of them supply a framework or a hypothesis
rather than a pattern catchable in this product's data.

Extrapolated to eight dimensions across three statuses, that is on the order of
**20–30 carefully read works for 8–10 useful cards** — plus a review pass on each
by someone qualified to sign it.

---

## 5. What the owner-supplied material turned out to be

The material provided was the initiative's strategy document (*Teachers'
Wellbeing Map*, 23 pages). Read in full. Three observations matter more than the
cards built from it.

**It is not a study.** It is a strategy and positioning document with a
literature review: vision, mission, three-year plan, theory of change, values. It
reports no data of its own. Its real payload is a bibliography of roughly 25
fully-cited works and a statement of which source supports which claim — a map to
sources, not a source.

**The eight dimensions are not in it.** The document sets out the OECD framework
(physical and mental, cognitive, subjective, social), lists commonly measured
factors, and names instruments — UWES, Gallup, WAMI, WEMWBS, Parker & Hyett. The
product's eight dimensions are derived from none of it. **The bridge between this
product's taxonomy and any published framework is undocumented**, in this
document and in this repository. Every dimension binding in the prototype cards
is therefore the agent's judgement, not a stated methodology.

This is arguably a more urgent gap than the evidence layer itself: an evidence
layer built on top of it would be citing literature about constructs that may or
may not be what the questionnaire measures.

**Governance now has a name.** The document names Dr. Irene Diamant, Head of the
Department of Occupational Psychology at the Academic College of Tel Aviv–Yaffo,
as providing research guidance and oversight of the tool's validity. The research
document listed "no owner for catalog content" as the blocking governance gap;
this is the answer to it, and it is outside the repository.

**One subtlety about ISO 45003.** The document cites SI 45003 (Hebrew edition,
identical to ISO 45003:2021) for the proposition that structured assessment
should precede intervention. In `data/interventions_kb.json`, ISO 45003 appears
as the `source` of 48 interventions, reading as though it backs the interventions
themselves. Those are different claims and the difference is currently invisible.

---

## 6. What this changes about the research document's alternatives

Nothing is retracted. Two things sharpen.

- **Alternative A** (offline enrichment, no new dependency) is confirmed as the
  only one the evidence supports starting with. Every useful part of this
  prototype ran offline, deterministically, with no network and no model.
- **The cross-dimension payoff is now demonstrated rather than argued.** The one
  card that worked keys on a contrast between two dimensions — precisely what
  eight independent provider calls cannot produce. If an evidence layer is ever
  built, this is the strongest reason it would be worth anything.

And one expectation should be reset before any product conversation: **an honest
evidence layer makes the copy more careful, not more authoritative.** The
strongest teacher-specific empirical source retrieved here is 17 teachers, no
control group, no follow-up, with the hypothesised mechanism unconfirmed. Cards
built on that literature spend most of their content constraining what may be
said. If recommendations start sounding more confident after such a layer is
added, it has been built wrong.

---

## 7. Open decisions this prototype adds

The research document's twelve decisions stand. Three more follow from this run.

1. **Is the dimension mapping worth establishing first?** Without it, every card
   binds to a dimension by judgement. Asking Dr. Diamant what the eight
   dimensions rest on would settle it and costs no engineering.
2. **Who signs a card?** Not who writes it — who is accountable for the claim a
   principal reads. The prototype shows a card can be produced in an afternoon;
   it says nothing about who may approve one.
3. **Is a 300-character floor on the visible body right?** It currently forces
   honest short claims to be padded threefold. That is a product-format decision
   with a direct effect on how much unsupported prose gets generated.

---

## Sources used in the prototype

- Carroll, A., York, A., Fynes-Clinton, S., Sanders-O'Connor, E., Flynn, L.,
  Bower, J. M., Forrest, K., & Ziaei, M. (2021). The downstream effects of
  teacher well-being programs. *Frontiers in Psychology*, 12, 689628.
  doi:10.3389/fpsyg.2021.689628
- He, Y., Payne, S. C., Beus, J. M., Muñoz, G. J., Yao, X., & Battista, V.
  (2023). Organizational climate profiles: Identifying meaningful combinations
  of climate level and strength. *Journal of Applied Psychology*, 108(4),
  595–620. doi:10.1037/apl0001036
- Schneider, B., Salvaggio, A. N., & Subirats, M. (2002). Climate strength: A
  new direction for climate research. *Journal of Applied Psychology*, 87(2),
  220–229. doi:10.1037/0021-9010.87.2.220
- Spilt, J. L., Koomen, H. M. Y., & Thijs, J. T. (2011). Teacher wellbeing: The
  importance of teacher–student relationships. *Educational Psychology Review*,
  23(4), 457–477. doi:10.1007/s10648-011-9170-y
- Viac, C., & Fraser, P. (2020). *Teachers' well-being: A framework for data
  collection and analysis* (OECD Education Working Papers No. 213). OECD
  Publishing. doi:10.1787/c36fc9d3-en
- Owner-supplied initiative strategy document, *Teachers' Wellbeing Map*
  (23 pp.), read in full. Not reproduced here or stored in this repository.
