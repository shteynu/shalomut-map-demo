import json
import os
from typing import List, Dict, Any
from src.schemas.mcp_types import StoneIntervention

class LocalInterventionVectorStore:
    def __init__(self, kb_path: str = "data/interventions_kb.json", chroma_dir: str = "./chroma_db"):
        self.kb_path = kb_path
        self.chroma_dir = chroma_dir
        self.raw_data: List[Dict[str, Any]] = []
        self._load_raw_kb()
        
    def _load_raw_kb(self):
        # Resolve path relative to project root
        resolved_path = self.kb_path
        if not os.path.exists(resolved_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
        limit: int = 3
    ) -> List[StoneIntervention]:
        """
        Retrieves top-N relevant organizational interventions for a specific dimension & status.
        Recommendations never cross dimension boundaries.
        """
        matched = [
            item for item in self.raw_data
            if item.get("dimension_id") == dimension_id and status in item.get("target_status", [])
        ]
        
        # Fallback to any intervention for this dimension if exact status match yields < limit
        if len(matched) < limit:
            matched.extend([
                item for item in self.raw_data
                if item.get("dimension_id") == dimension_id and item not in matched
            ])

        selected = matched[:limit]
        
        return [
            StoneIntervention(
                id=item["id"],
                dimensionId=item["dimension_id"],
                source=item["source"],
                title=item["title"],
                summary=item["summary"],
                actionable_steps=item.get("actionable_steps", [])
            )
            for item in selected
        ]
