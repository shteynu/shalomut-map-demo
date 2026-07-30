"""What Core asks for when a manager wants another questionnaire item.

Deliberately not part of the round-analytics contract. Versions 1.0-5.0 describe
a compiled Stone Map travelling in one direction on a webhook and a callback;
this is a manager waiting on one sentence, with no round, no aggregates and no
respondent data anywhere in it. Folding it into those versions would have made a
questionnaire draft a reason to bump a contract every consumer validates.
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

# How much of the manager's draft travels with the request. A dimension holds a
# handful of items, so the bound is only there to keep a prompt from growing
# without limit; the duplicate check reads the same bounded list, which is
# acceptable because the manager rewrites the suggestion before it joins the
# questionnaire and Core enforces unique ids on save.
MAX_EXISTING_TEXTS = 40
MAX_EXISTING_TEXT_LENGTH = 300


@dataclass
class QuestionSuggestionRequest:
    dimensionId: str
    existingTexts: Optional[List[str]] = None

    def bounded_existing_texts(self) -> List[str]:
        texts = [
            text.strip()[:MAX_EXISTING_TEXT_LENGTH]
            for text in (self.existingTexts or [])
            if isinstance(text, str) and text.strip()
        ]
        return texts[:MAX_EXISTING_TEXTS]


@dataclass
class QuestionSuggestionResponse:
    dimensionId: str
    dimensionNameHebrew: str
    questionText: str
    attempts: int
    # Always `llm` on a successful answer: this service has no template of its
    # own to fall back to, and inventing one here would be a suggestion the
    # model never made. Core labels its template library as the template.
    source: str = "llm"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
