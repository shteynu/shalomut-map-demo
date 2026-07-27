import json
import os
from typing import List, Dict, Any, Optional, Tuple
from src.rag.topics import topics_for_text
from src.schemas.mcp_types import StoneIntervention

# A matched topic is worth more than a background-context hint on its own, but
# two schools that differ only in context should still diverge.
_TOPIC_MATCH_WEIGHT = 3.0
_BACKGROUND_MATCH_WEIGHT = 5.0
_POLARIZATION_WEIGHT = 2.0

# Topics whose interventions act on individual people or on the differences
# between them, as opposed to topics whose interventions change something the
# whole staff shares. A split staff (half green, half red) needs the first
# kind; a staff that is uniformly lukewarm needs the second.
_DIFFERENTIATED_TOPICS = frozenset(
    {
        "relations",
        "mentoring",
        "onboarding",
        "trust",
        "recognition",
        "health",
        "authenticity",
        "choice",
    },
)


class LocalInterventionVectorStore:
    def __init__(
        self,
        kb_path: str = "data/interventions_kb.json",
        chroma_dir: str = "./chroma_db",
    ):
        self.kb_path = kb_path
        self.chroma_dir = chroma_dir
        self.raw_data: List[Dict[str, Any]] = []
        self._load_raw_kb()

    def _load_raw_kb(self):
        # Resolve path relative to project root
        resolved_path = self.kb_path
        if not os.path.exists(resolved_path):
            base_dir = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            resolved_path = os.path.join(base_dir, self.kb_path)

        if os.path.exists(resolved_path):
            with open(resolved_path, "r", encoding="utf-8") as f:
                self.raw_data = json.load(f)
        else:
            self.raw_data = []

    @staticmethod
    def _distribution_counts(aggregate: Dict[str, Any]) -> Optional[Dict[str, int]]:
        distribution = aggregate.get("scoreDistribution")
        if not isinstance(distribution, dict):
            return None

        counts = {}
        for bucket in ("green", "yellow", "red"):
            count = distribution.get(bucket)
            if not isinstance(count, int) or isinstance(count, bool):
                return None
            counts[bucket] = count

        if sum(counts.values()) <= 0:
            return None
        return counts

    @classmethod
    def _question_severity(cls, aggregate: Dict[str, Any]) -> Optional[float]:
        """How badly a question is doing, judged by its distribution.

        Weighting red fully and yellow by half keeps the reading close to the
        average, which is what a status is judged on.
        """
        counts = cls._distribution_counts(aggregate)
        if counts is None:
            return None

        total = sum(counts.values())
        return (counts["red"] + 0.5 * counts["yellow"]) / total

    @classmethod
    def _question_polarization(cls, aggregate: Dict[str, Any]) -> Optional[float]:
        """How split the staff is on a question, from 0 (agreed) to 1 (halved).

        This is the reading the average — and the severity above — cannot give:
        ten lukewarm answers and a staff divided into five green and five red
        both score 60, and both are equally severe, but only the second one is
        a disagreement between people. It is the case the plan names, and it
        decides whether an intervention should change something everyone
        shares or work on the difference between colleagues.
        """
        counts = cls._distribution_counts(aggregate)
        if counts is None:
            return None

        total = sum(counts.values())
        return 4.0 * counts["green"] * counts["red"] / (total * total)

    @classmethod
    def _weighted_question_topics(
        cls,
        question_aggregates: Optional[List[Dict[str, Any]]],
    ) -> Dict[str, float]:
        """Topics of the dimension's questions, weighted by how badly each fell.

        Every question contributes, so the ranking follows the shape of the
        round rather than one winner-takes-all pick: a school where the load
        question collapsed and a school where the peer-support question
        collapsed weight the same catalog differently even when both averages
        are identical.
        """
        weighted: Dict[str, float] = {}
        for aggregate in question_aggregates or []:
            if not isinstance(aggregate, dict):
                continue
            average_score = aggregate.get("averageScore")
            if not isinstance(average_score, (int, float)):
                continue

            severity = cls._question_severity(aggregate)
            if severity is None:
                # 3.0 and 4.0 rounds carry no distribution at all.
                severity = max(0.0, (100.0 - float(average_score)) / 100.0)

            text = (
                aggregate.get("questionText")
                or aggregate.get("questionTextHebrew")
                or ""
            )
            for topic in topics_for_text(text):
                weighted[topic] = weighted.get(topic, 0.0) + severity
        return weighted

    @classmethod
    def _round_polarization(
        cls,
        question_aggregates: Optional[List[Dict[str, Any]]],
    ) -> Optional[float]:
        """How split the dimension's questions are, weighted by severity.

        The questions that fell hardest decide the reading: a split on a
        question everyone answers green says little about what to do next.
        Rounds without a distribution (3.0 and 4.0) get no reading at all
        rather than a made-up one.
        """
        weighted_sum = 0.0
        weight_total = 0.0
        for aggregate in question_aggregates or []:
            if not isinstance(aggregate, dict):
                continue
            polarization = cls._question_polarization(aggregate)
            if polarization is None:
                continue
            # Every question counts, but a failing one counts more; the floor
            # keeps a healthy dimension from dividing by zero.
            weight = max(0.1, cls._question_severity(aggregate) or 0.0)
            weighted_sum += weight * polarization
            weight_total += weight

        if weight_total <= 0:
            return None
        return weighted_sum / weight_total

    @staticmethod
    def _reach_lean(item_topics: set) -> float:
        """-1 when an entry acts on what the staff shares, +1 on differences."""
        if not item_topics:
            return 0.0
        differentiated = len(item_topics & _DIFFERENTIATED_TOPICS)
        return (2 * differentiated - len(item_topics)) / len(item_topics)

    @staticmethod
    def _topics_for_item(item: Dict[str, Any]) -> set:
        return topics_for_text(
            " ".join(
                [
                    item.get("title", ""),
                    item.get("summary", ""),
                    *item.get("actionable_steps", []),
                ],
            ),
        )

    @staticmethod
    def _topic_rarity(topics_by_item: List[set]) -> Dict[str, float]:
        """How much a topic says about which candidate fits.

        A topic every candidate in the pool mentions cannot separate them and
        is worth nothing; a topic only one of them raises is worth everything.
        Dropping shared topics outright was too blunt — inside one dimension
        the shared topic is usually the dimension itself, which is also what
        its questions ask about, so the whole pool scored zero.
        """
        count = len(topics_by_item)
        if count <= 1:
            return {}

        document_frequency: Dict[str, int] = {}
        for item_topics in topics_by_item:
            for topic in item_topics:
                document_frequency[topic] = document_frequency.get(topic, 0) + 1

        return {
            topic: (count - frequency) / (count - 1)
            for topic, frequency in document_frequency.items()
        }

    @staticmethod
    def _background_score(
        item: Dict[str, Any],
        background_context: Optional[Dict[str, Any]],
    ) -> float:
        if not isinstance(background_context, dict):
            return 0.0

        tags = item.get("tags", [])
        score = 0.0
        sickness = background_context.get("sicknessDaysThisQuarter", 0)
        if isinstance(sickness, (int, float)) and sickness > 3 and "sickness" in tags:
            score += _BACKGROUND_MATCH_WEIGHT
        new_staff = background_context.get("newStaffMembers", 0)
        if isinstance(new_staff, (int, float)) and new_staff > 2 and "new_staff" in tags:
            score += _BACKGROUND_MATCH_WEIGHT
        return score

    def get_interventions_for_dimension(
        self,
        dimension_id: str,
        status: str,
        limit: int = 3,
        question_aggregates: Optional[List[Dict[str, Any]]] = None,
        background_context: Optional[Dict[str, Any]] = None,
    ) -> List[StoneIntervention]:
        """Top-N interventions for one dimension and status.

        Candidates are ranked by how well they speak to the question that
        dropped hardest — read from the distribution rather than the average —
        and to the school's background context. Recommendations never cross a
        dimension or status boundary.
        """
        matched = [
            item
            for item in self.raw_data
            if item.get("dimension_id") == dimension_id
            and status in item.get("target_status", [])
        ]

        if not matched:
            return []

        question_topics = self._weighted_question_topics(question_aggregates)
        topics_by_item = [self._topics_for_item(item) for item in matched]
        rarity = self._topic_rarity(topics_by_item)
        polarization = self._round_polarization(question_aggregates)

        scored_items = []
        for index, (item, item_topics) in enumerate(zip(matched, topics_by_item)):
            score = _TOPIC_MATCH_WEIGHT * sum(
                question_topics.get(topic, 0.0) * rarity.get(topic, 0.0)
                for topic in item_topics
            )
            if polarization is not None:
                # A halved staff pulls the ranking towards entries that work on
                # the difference between people; an agreed one pulls it back
                # towards entries that change what everybody shares.
                score += (
                    _POLARIZATION_WEIGHT
                    * (2.0 * polarization - 1.0)
                    * self._reach_lean(item_topics)
                )
            score += self._background_score(item, background_context)

            # Tie breaker by original catalogue order.
            scored_items.append((score, -index, item))

        scored_items.sort(key=lambda x: (x[0], x[1]), reverse=True)
        selected = [x[2] for x in scored_items[:limit]]

        return [
            StoneIntervention(
                id=item["id"],
                dimensionId=item["dimension_id"],
                source=item["source"],
                title=item["title"],
                summary=item["summary"],
                actionable_steps=item.get("actionable_steps", []),
            )
            for item in selected
        ]
