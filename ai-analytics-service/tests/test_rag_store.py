import json
import re
from pathlib import Path

from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.rag.store import LocalInterventionVectorStore


CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "interventions_kb.json"
DIMENSION_STATUSES = ("green", "yellow", "red")
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

    assert {item["dimension_id"] for item in catalog} == set(
        AI_ANALYTICS_DIMENSION_IDS,
    )
    for item in catalog:
        assert item["target_status"]
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
