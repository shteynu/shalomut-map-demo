import json
import logging
import urllib.request
from typing import Optional, Tuple
from src.config import settings

logger = logging.getLogger(__name__)

class LLMProviderService:
    """
    Decoupled LLM Provider & Model Router Service.
    Encapsulates token economy rules, model tier selection (Fast vs Heavy),
    prompt construction, and provider API execution with graceful fallback.
    """

    def generate_psychological_interpretation(
        self, 
        dim_id: str, 
        dim_hebrew: str, 
        score: float, 
        status: str,
        retry_tier: str = "fast"
    ) -> str:
        """
        Generates psychological interpretation with strict token optimization:
        1. 0 Tokens on 'green' dimensions if `only_llm_for_problematic` is Enabled.
        2. Routes to fast model (gpt-4o-mini / claude-haiku) by default.
        3. Enforces strict max_tokens cap.
        4. Gracefully falls back to domain heuristics if API key is missing or offline.
        """
        # Token Optimization Rule: 0 tokens spent on healthy green dimensions
        if settings.only_llm_for_problematic and status == "green":
            logger.info(f"[LLM Service] Token Optimization: Skipped LLM call for green dimension '{dim_id}' (0 tokens).")
            return f"מדד '{dim_hebrew}' מצוי באזור ירוק (ציון {score:.1f}). הצוות מביע שביעות רצון גבוהה וחיבור חיובי לתחום זה."

        # Model Tier Selection
        model_name = settings.openai_model_heavy if retry_tier == "heavy" else settings.openai_model_fast

        if settings.openai_api_key:
            try:
                prompt = (
                    f"You are an expert Organizational Psychologist analyzing teacher wellbeing.\n"
                    f"Dimension: '{dim_hebrew}' ({dim_id}). Score: {score:.1f}/100. Status: {status.upper()}.\n"
                    f"Write a concise 2-sentence psychological interpretation in HEBREW explaining organizational causes and impact."
                )
                req_payload = json.dumps({
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a concise organizational psychologist for educational staff."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": settings.max_tokens_per_dimension,
                    "temperature": 0.2
                }).encode("utf-8")

                req = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions",
                    data=req_payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {settings.openai_api_key}"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10.0) as response:
                    if response.status == 200:
                        res = json.loads(response.read().decode("utf-8"))
                        return res["choices"][0]["message"]["content"].strip()
            except Exception as e:
                logger.warning(f"[LLM Service] LLM API call failed ({e}), using domain heuristic fallback.")

        # Fallback Heuristic Generator
        return self._heuristic_fallback(dim_hebrew, score, status)

    def _heuristic_fallback(self, dim_hebrew: str, score: float, status: str) -> str:
        if status == "red":
            return (
                f"מדד '{dim_hebrew}' מצוי באזור אדום (ציון {score:.1f}). "
                f"ניתוח פסיכולוגי ארגוני מצביע על שחיקה גבוהה ותחושת מצוקה מבנית בקרב צוות ההוראה. "
                f"יש לנקוט בצעדים מיידיים להפחתת הלחץ ולמתן מענה ארגוני תומך."
            )
        elif status == "yellow":
            return (
                f"מדד '{dim_hebrew}' מצוי באזור צהוב (ציון {score:.1f}). "
                f"נצפית מגמת שחיקה מתונה הדורשת תשומת לב מונעת מצד הנהלת בית הספר. "
                f"מומלץ לחזק את ערוצי התקשורת ולהטמיע שיפורים תהליכיים."
            )
        return (
            f"מדד '{dim_hebrew}' מצוי באזור ירוק (ציון {score:.1f}). "
            f"הצוות מביע שביעות רצון גבוהה וחיבור חיובי לתחום זה."
        )

llm_provider_service = LLMProviderService()
