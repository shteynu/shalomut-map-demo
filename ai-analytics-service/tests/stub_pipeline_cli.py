"""Run the real pipeline over stdin with the provider calls answered locally.

Core's cross-service boundary test needs a complete Stone Map to validate its
callback against, and a round whose provider never answers now fails by design
— correctly, but that leaves the boundary itself untested. This entry point is
the shipping pipeline: same graph, same safety validator, same formatter. Only
the two model-written calls are stubbed, and only here, so no flag exists in the
service that could put invented copy in front of a manager.
"""

from src.pipeline_cli import main
from tests.llm_stub import answering_llm_provider

if __name__ == "__main__":
    with answering_llm_provider():
        main()
