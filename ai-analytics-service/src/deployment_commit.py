"""Which commit this service instance is actually running.

`/health` has reported a `commit` since it had one, and until now it reported
whatever `RENDER_GIT_COMMIT` happened to hold, cut to seven characters. Core's
`/api/health` publishes the same field under a rule instead — the value is
published only when it is provably a Git SHA and could be nothing else — and
the two halves of the system answering the same question by different rules is
what this module ends.

Kept apart from `main.py` so the rule can be asserted directly. What makes the
field safe on an anonymous endpoint is not the variable it reads but the shape
it insists on, and that is worth testing without an HTTP response in the way.
`PROJECT_CONTEXT.md` ADR-023 owns the rule for both services.
"""

import os
import re
from typing import Mapping, Optional

#: The variable Render sets on every deploy. Named here rather than read inline
#: so the test and the endpoint cannot drift onto two different names.
DEPLOYMENT_COMMIT_ENV = "RENDER_GIT_COMMIT"

#: What an unreadable or absent commit reports. Never an empty string: a blank
#: value reads as "no commit" rather than "this instance cannot say", and the
#: two are different answers.
UNKNOWN_DEPLOYMENT_COMMIT = "unknown"

#: How much of the SHA is published, matching what Core reports and what
#: `git log --oneline` prints, so the two can be compared by eye.
SHORT_COMMIT_LENGTH = 7

#: A full Git SHA-1 and nothing else: exactly forty hex digits. Exactly forty,
#: not "at least" — this repository generates its shared secrets with
#: `openssl rand -hex 32`, which is sixty-four hex characters and would pass a
#: lower bound. A secret has no business in this variable, and the endpoint
#: does not get to assume so.
_FULL_COMMIT_SHA = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)


def resolve_deployment_commit(
    env: Optional[Mapping[str, str]] = None,
) -> str:
    """The short commit this instance runs, or `unknown`.

    Unknown is the honest answer in three different situations and deliberately
    does not distinguish them: running locally, where no deploy variable
    exists; a host that names the variable something else; and a value that is
    not a commit SHA. A caller comparing this against `git rev-parse` learns
    the same thing from all three — this instance cannot prove what it runs —
    and separating them would only describe the deployment's own configuration
    to an anonymous caller.
    """
    source = os.environ if env is None else env
    value = (source.get(DEPLOYMENT_COMMIT_ENV) or "").strip()

    if not _FULL_COMMIT_SHA.match(value):
        return UNKNOWN_DEPLOYMENT_COMMIT

    return value[:SHORT_COMMIT_LENGTH].lower()
