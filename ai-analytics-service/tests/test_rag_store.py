from src.rag.store import LocalInterventionVectorStore

def test_rag_store_query():
    store = LocalInterventionVectorStore()
    interventions = store.get_interventions_for_dimension(
        dimension_id="workload_balance",
        status="red",
        limit=3
    )
    
    assert len(interventions) > 0
    assert any("ISO 45003" in i.source or "OECD" in i.source for i in interventions)
    assert interventions[0].title != ""
    assert len(interventions[0].actionable_steps) > 0
