"""What `/health` is allowed to say about the revision it runs.

These assert the rule rather than the endpoint: the value reaches an anonymous
caller, so what matters is which inputs produce a published string and which
produce `unknown`. Going through the route instead would test the same rule
once, through an environment variable, with the interesting cases hidden behind
a JSON body.

The Core half of this rule is asserted in
`src/lib/__tests__/deployment-commit.test.ts`, case for case. The two files are
meant to read as the same test, because the field is meant to answer the same
question on both endpoints.
"""

from fastapi.testclient import TestClient

from src.deployment_commit import (
    DEPLOYMENT_COMMIT_ENV,
    UNKNOWN_DEPLOYMENT_COMMIT,
    resolve_deployment_commit,
)
from src.main import app

SHA = "a3dd4fedf2a54deded3497456cbdbbb896009ee2"


def resolve(value):
    return resolve_deployment_commit(
        {} if value is None else {DEPLOYMENT_COMMIT_ENV: value},
    )


def test_a_real_commit_sha_is_published_shortened_the_way_git_prints_it():
    assert resolve(SHA) == "a3dd4fe"
    assert len(resolve(SHA)) == 7


def test_an_uppercase_sha_is_still_a_sha_and_is_published_in_one_case():
    # Nothing sets it uppercase today. If something did, two deploys of the
    # same commit must not read as two different commits.
    assert resolve(SHA.upper()) == "a3dd4fe"


def test_surrounding_whitespace_does_not_make_a_commit_unreadable():
    assert resolve(f"  {SHA}\n") == "a3dd4fe"


def test_an_instance_that_cannot_name_its_commit_says_so_instead_of_guessing():
    # Running locally: the variable does not exist at all.
    assert resolve(None) == UNKNOWN_DEPLOYMENT_COMMIT
    assert resolve("") == UNKNOWN_DEPLOYMENT_COMMIT
    assert resolve("   ") == UNKNOWN_DEPLOYMENT_COMMIT


def test_only_a_full_forty_character_sha_is_published():
    # A short SHA is a real thing to hold and still refused: publishing it
    # would mean the endpoint sometimes reports seven characters of a value it
    # never verified the length of.
    assert resolve(SHA[:7]) == UNKNOWN_DEPLOYMENT_COMMIT
    assert resolve(SHA[:39]) == UNKNOWN_DEPLOYMENT_COMMIT
    assert resolve(f"{SHA}0") == UNKNOWN_DEPLOYMENT_COMMIT


def test_a_value_that_is_not_a_commit_is_never_published_not_even_in_part():
    """The rule that makes this field safe on an anonymous endpoint.

    A secret in this variable would be a misconfiguration; the endpoint must
    not be what turns it into a disclosure. This is the case the old
    seven-character truncation got wrong: it published the first seven
    characters of whatever was there.
    """
    not_commits = [
        # `openssl rand -hex 32`, which is how this repository makes its
        # secrets: hex, and sixty-four characters rather than forty.
        "f" * 64,
        "postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_test",
        "refs/heads/main",
        "v1.2.3",
        "unknown",
    ]

    for value in not_commits:
        assert resolve(value) == UNKNOWN_DEPLOYMENT_COMMIT, (
            f"{value[:24]} was published"
        )


def test_the_resolver_reads_the_process_environment_when_given_none(monkeypatch):
    monkeypatch.setenv(DEPLOYMENT_COMMIT_ENV, SHA)
    assert resolve_deployment_commit() == "a3dd4fe"


def test_health_publishes_what_the_rule_resolves(monkeypatch):
    """The one case worth reading through the endpoint: that it uses the rule.

    A route that resolved correctly and then published something else would
    pass every test above.
    """
    monkeypatch.setenv(DEPLOYMENT_COMMIT_ENV, SHA)
    body = TestClient(app).get("/health").json()
    assert body["commit"] == "a3dd4fe"

    monkeypatch.setenv(DEPLOYMENT_COMMIT_ENV, "not-a-commit")
    body = TestClient(app).get("/health").json()
    assert body["commit"] == UNKNOWN_DEPLOYMENT_COMMIT
