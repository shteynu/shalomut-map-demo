from scripts.check_version_literals import check_python_source


def test_fitness_gate_catches_legacy_version_branches():
    assert check_python_source("if version == '1.0':\n    pass")
    assert check_python_source("if version in {'2.0'}:\n    pass")


def test_fitness_gate_catches_named_version_constants():
    assert check_python_source(
        "if version == AI_ANALYTICS_V5_CONTRACT_VERSION:\n    pass"
    )
    assert check_python_source(
        "if version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS:\n    pass"
    )


def test_fitness_gate_accepts_capability_branching():
    assert check_python_source(
        "if capabilities.supportsPartialMaps:\n    pass"
    ) == []
