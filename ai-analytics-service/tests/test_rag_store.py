import json
import re
from pathlib import Path

import pytest

from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.rag.store import LocalInterventionVectorStore
from src.rag.topics import topics_for_text


CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "interventions_kb.json"
# The questionnaire lives in the Core app; the service only ever sees its text
# in a payload. Present when the service is checked out inside the monorepo,
# absent when it is deployed on its own.
QUESTIONNAIRE_PATH = (
    Path(__file__).resolve().parents[2] / "src" / "lib" / "shalomut-source.ts"
)
QUESTION_PATTERN = re.compile(
    r'question\(\s*"([a-z-]+-\d)",\s*"([a-z-]+)",\s*"([^"]+)"',
    re.S,
)
DIMENSION_STATUSES = ("green", "yellow", "red")
# The three balance questions as the Core app sends them.
BALANCE_QUESTIONS = (
    ("balance-1", "אני מצליחה לבצע את משימות העבודה בזמן שנקבע."),
    ("balance-2", "יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה."),
    ("balance-3", "אני מרגישה שהעומס בעבודה מתאים לי והוא בהישג יד."),
)


def balance_aggregates(distribution):
    """One dimension's aggregates, every question carrying the same shape."""
    return [
        {
            "questionId": question_id,
            "dimensionId": "balance",
            "questionText": text,
            "averageScore": 60.0,
            "responseCount": sum(distribution.values()),
            "scoreDistribution": dict(distribution),
        }
        for question_id, text in BALANCE_QUESTIONS
    ]
HEBREW_PATTERN = re.compile(r"[\u0590-\u05FF]")
LATIN_PATTERN = re.compile(r"[A-Za-z]+")
ALLOWED_SOURCE_CITATIONS = {"ISO", "OECD", "TALIS"}


def load_catalog():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def test_rag_store_query():
    store = LocalInterventionVectorStore(kb_path=str(CATALOG_PATH))
    interventions = store.get_interventions_for_dimension(
        dimension_id="balance",
        status="red",
        limit=3,
    )

    assert len(interventions) > 0
    assert any("ISO 45003" in i.source or "OECD" in i.source for i in interventions)
    assert interventions[0].title != ""
    assert len(interventions[0].actionable_steps) > 0


def test_query_returns_only_exact_status_matches_without_backfill(tmp_path):
    catalog_path = tmp_path / "interventions.json"
    catalog_path.write_text(
        json.dumps(
            [
                {
                    "id": "green-entry",
                    "dimension_id": "balance",
                    "source": "מקור בדיקה",
                    "title": "חוזקה לשימור: איזון",
                    "summary": "פעולה לשימור האיזון הקיים.",
                    "actionable_steps": ["לשמר זמן מוגן."],
                    "target_status": ["green"],
                },
                {
                    "id": "red-entry",
                    "dimension_id": "balance",
                    "source": "מקור בדיקה",
                    "title": "מענה לעומס חריג",
                    "summary": "פעולה ממוקדת להפחתת עומס.",
                    "actionable_steps": ["למפות עומסים."],
                    "target_status": ["red"],
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    store = LocalInterventionVectorStore(kb_path=str(catalog_path))

    green = store.get_interventions_for_dimension("balance", "green", limit=3)
    red = store.get_interventions_for_dimension("balance", "red", limit=3)
    yellow = store.get_interventions_for_dimension("balance", "yellow", limit=3)

    assert [item.id for item in green] == ["green-entry"]
    assert [item.id for item in red] == ["red-entry"]
    assert yellow == []


def test_catalog_has_exact_status_coverage_for_every_canonical_dimension():
    catalog = load_catalog()

    assert len({item["id"] for item in catalog}) == len(catalog)
    assert {item["dimension_id"] for item in catalog} == set(
        AI_ANALYTICS_DIMENSION_IDS,
    )
    for item in catalog:
        assert item["target_status"]
        assert len(item["target_status"]) == 1, item["id"]
        assert set(item["target_status"]) <= set(DIMENSION_STATUSES)

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        for status in DIMENSION_STATUSES:
            matching = [
                item
                for item in catalog
                if item["dimension_id"] == dimension_id
                and status in item["target_status"]
            ]
            assert matching, f"Missing {status} intervention for {dimension_id}"


def test_catalog_user_facing_copy_is_hebrew():
    for item in load_catalog():
        user_facing_texts = [
            item["title"],
            item["summary"],
            *item["actionable_steps"],
        ]
        for text in user_facing_texts:
            assert HEBREW_PATTERN.search(text), f"Missing Hebrew copy in {item['id']}"
            assert not LATIN_PATTERN.search(text), f"English copy remains in {item['id']}"

        assert HEBREW_PATTERN.search(item["source"]), (
            f"Source description is not localized for {item['id']}"
        )
        source_words = set(LATIN_PATTERN.findall(item["source"]))
        assert source_words <= ALLOWED_SOURCE_CITATIONS, (
            f"Untranslated source description remains in {item['id']}: {source_words}"
        )


def test_green_catalog_entries_are_strength_preservation_actions():
    """Green recommendations preserve a strength; the others improve a gap.

    The intent is declared by the entry itself. Asserting it through the
    heading the dashboard already renders for a green stone ("חוזקה לשימור",
    see ai-insights-view-model.ts) would only check that the copy repeats the
    heading, not that the recommendation means preservation.
    """
    catalog = load_catalog()
    green_entries = [item for item in catalog if "green" in item["target_status"]]

    assert {item["dimension_id"] for item in green_entries} == set(
        AI_ANALYTICS_DIMENSION_IDS,
    )
    for item in green_entries:
        assert item["target_status"] == ["green"]
        assert item["intent"] == "preserve", item["id"]

    for item in catalog:
        expected = "preserve" if item["target_status"] == ["green"] else "improve"
        assert item["intent"] == expected, item["id"]


def test_unknown_or_uncovered_status_returns_empty_list():
    store = LocalInterventionVectorStore(kb_path=str(CATALOG_PATH))

    assert store.get_interventions_for_dimension("unknown", "green") == []
    assert store.get_interventions_for_dimension("balance", "unknown") == []


def test_every_dimension_and_status_pair_has_room_to_choose():
    """Ranking needs candidates it can reject.

    With three entries and a limit of three, two schools with the same status
    received the same recommendations whatever the ranking said — the exact
    complaint the catalog expansion was meant to answer.
    """
    catalog = load_catalog()
    store = LocalInterventionVectorStore(kb_path=str(CATALOG_PATH))

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        for status in DIMENSION_STATUSES:
            pool = [
                item
                for item in catalog
                if item["dimension_id"] == dimension_id
                and status in item["target_status"]
            ]
            assert len(pool) >= 8, f"{dimension_id}/{status} has {len(pool)}"

            selected = store.get_interventions_for_dimension(
                dimension_id,
                status,
                limit=5,
            )
            assert len(selected) == 5, f"{dimension_id}/{status}"
            assert len({item.id for item in selected}) == 5


def test_the_average_cannot_tell_a_lukewarm_round_from_a_split_one():
    """The reading the whole slice exists for.

    Ten yellow answers and a staff halved into green and red both average 60
    and are equally severe. Only the polarization separates them, so it has to
    be the thing that is measured, not the average and not the severity.
    """
    uniform = {"scoreDistribution": {"green": 0, "yellow": 10, "red": 0}}
    split = {"scoreDistribution": {"green": 5, "yellow": 0, "red": 5}}
    store = LocalInterventionVectorStore

    assert store._question_severity(uniform) == store._question_severity(split)
    assert store._question_polarization(uniform) == 0.0
    assert store._question_polarization(split) == 1.0


def test_a_split_staff_and_a_lukewarm_staff_get_different_recommendations():
    """The plan's acceptance criterion, on the shipped catalog.

    Same dimension, same average on every question, same status — only the
    shape of the answers differs, and the recommendations have to differ with
    it. A round without a distribution (3.0, 4.0) still has to be served, so
    the ranking falls back to the average instead of failing.
    """
    store = LocalInterventionVectorStore(kb_path=str(CATALOG_PATH))

    for status in DIMENSION_STATUSES:
        lukewarm = store.get_interventions_for_dimension(
            "balance",
            status,
            limit=5,
            question_aggregates=balance_aggregates(
                {"green": 0, "yellow": 10, "red": 0},
            ),
        )
        split = store.get_interventions_for_dimension(
            "balance",
            status,
            limit=5,
            question_aggregates=balance_aggregates(
                {"green": 5, "yellow": 0, "red": 5},
            ),
        )

        assert {item.id for item in lukewarm} != {item.id for item in split}, status

    without_distribution = [
        {key: value for key, value in aggregate.items() if key != "scoreDistribution"}
        for aggregate in balance_aggregates({"green": 0, "yellow": 10, "red": 0})
    ]
    assert (
        len(
            store.get_interventions_for_dimension(
                "balance",
                "red",
                limit=3,
                question_aggregates=without_distribution,
            ),
        )
        == 3
    )


def test_the_question_that_fell_hardest_decides_which_entries_surface(tmp_path):
    """The mechanism, on a catalog whose entries are cleanly separated.

    Two schools answer the same two questions with the same averages; they
    differ only in which of the two collapsed. The catalog here keeps one
    entry per theme so the effect is readable — the shipped catalog mixes
    themes inside one entry, which softens it but does not change the rule.
    """
    catalog_path = tmp_path / "interventions.json"
    catalog_path.write_text(
        json.dumps(
            [
                {
                    "id": f"kb-{topic}",
                    "dimension_id": "balance",
                    "source": "מקור בדיקה",
                    "title": title,
                    "summary": summary,
                    "actionable_steps": [summary],
                    "target_status": ["red"],
                    "intent": "improve",
                }
                for topic, title, summary in (
                    ("workload", "הפחתת עומס", "למפות את העומס ולתעדף משימות."),
                    ("growth", "פיתוח מקצועי", "לבנות סדנה והכשרה פדגוגית."),
                    ("relations", "קשרים בצוות", "לקיים מפגשים של עמיתים בצוות."),
                )
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    store = LocalInterventionVectorStore(kb_path=str(catalog_path))

    def aggregates(load_distribution, growth_distribution):
        return [
            {
                "questionId": "q-load",
                "dimensionId": "balance",
                "questionText": "העומס בעבודה מתאים לי.",
                "averageScore": 60.0,
                "responseCount": 10,
                "scoreDistribution": load_distribution,
            },
            {
                "questionId": "q-growth",
                "dimensionId": "balance",
                "questionText": "יש לי הכשרה מקצועית מספקת.",
                "averageScore": 60.0,
                "responseCount": 10,
                "scoreDistribution": growth_distribution,
            },
        ]

    heavy = {"green": 1, "yellow": 2, "red": 7}
    light = {"green": 7, "yellow": 2, "red": 1}

    load_collapsed = store.get_interventions_for_dimension(
        "balance",
        "red",
        limit=1,
        question_aggregates=aggregates(heavy, light),
    )
    growth_collapsed = store.get_interventions_for_dimension(
        "balance",
        "red",
        limit=1,
        question_aggregates=aggregates(light, heavy),
    )

    assert [item.id for item in load_collapsed] == ["kb-workload"]
    assert [item.id for item in growth_collapsed] == ["kb-growth"]


def test_every_questionnaire_question_carries_at_least_one_topic():
    """The lexicon has to speak the questionnaire's language.

    The catalog talks in nouns about actions and the questionnaire talks in
    the first person about feelings. When a question matches no topic it
    contributes nothing to the ranking however badly it fell, which is how
    half the questionnaire was silently ignored before this slice.
    """
    if not QUESTIONNAIRE_PATH.exists():
        pytest.skip("Core questionnaire is not checked out next to the service")

    questions = QUESTION_PATTERN.findall(
        QUESTIONNAIRE_PATH.read_text(encoding="utf-8"),
    )
    assert len(questions) >= 3 * len(AI_ANALYTICS_DIMENSION_IDS)

    topics_by_dimension = {}
    for question_id, dimension_id, text in questions:
        topics = topics_for_text(text)
        assert topics, f"{question_id} matches no topic"
        topics_by_dimension.setdefault(dimension_id, []).append(frozenset(topics))

    for dimension_id, topic_sets in topics_by_dimension.items():
        assert len(set(topic_sets)) > 1, (
            f"every {dimension_id} question reads the same; "
            "the ranking cannot tell its questions apart"
        )
