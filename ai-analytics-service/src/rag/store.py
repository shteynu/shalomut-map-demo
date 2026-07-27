import json
import os
from typing import List, Dict, Any, Optional
from src.schemas.mcp_types import StoneIntervention


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

    def get_interventions_for_dimension(
        self,
        dimension_id: str,
        status: str,
        limit: int = 3,
        question_aggregates: Optional[List[Dict[str, Any]]] = None,
        background_context: Optional[Dict[str, Any]] = None,
    ) -> List[StoneIntervention]:
        """
        Retrieves top-N relevant organizational interventions for a specific dimension & status,
        ranked adaptively based on lowest question drop score and school background context.
        Recommendations never cross dimension or status boundaries.
        """
        matched = [
            item
            for item in self.raw_data
            if item.get("dimension_id") == dimension_id
            and status in item.get("target_status", [])
        ]

        if not matched:
            return []

        # Find lowest scoring question for context matching
        lowest_question_text = ""
        if question_aggregates:
            valid_q = [
                q
                for q in question_aggregates
                if isinstance(q, dict)
                and isinstance(q.get("averageScore"), (int, float))
            ]
            if valid_q:
                min_q = min(valid_q, key=lambda q: float(q["averageScore"]))
                lowest_question_text = (
                    min_q.get("questionText")
                    or min_q.get("questionTextHebrew")
                    or ""
                )

        scored_items = []
        for index, item in enumerate(matched):
            score = 0.0
            tags = item.get("tags", [])

            if isinstance(background_context, dict):
                sickness = background_context.get("sicknessDaysThisQuarter", 0)
                if sickness > 3 and "sickness" in tags:
                    score += 5.0
                new_staff = background_context.get("newStaffMembers", 0)
                if new_staff > 2 and "new_staff" in tags:
                    score += 5.0

            if lowest_question_text:
                item_text = (
                    f"{item.get('title', '')} {item.get('summary', '')}"
                )
                # Simple keyword overlap boost
                for word in lowest_question_text.split():
                    if len(word) > 3 and word in item_text:
                        score += 2.0

            # Tie breaker by original catalogue order
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
