import os
import sys
import re

# ensure we load from .env
from dotenv import load_dotenv
load_dotenv(".env")

from src.services.llm_provider import llm_provider_service

def test_overall():
    print("Testing overall summary...")
    dim_scores = {
        "balance": {"averageScore": 45.0, "computedStatus": "red"},
        "meaning": {"averageScore": 85.0, "computedStatus": "green"}
    }
    
    original_complete = llm_provider_service._complete_with_retries
    
    def mocked_complete(*args, **kwargs):
        original_acceptable = kwargs['is_acceptable']
        def patched_acceptable(candidate, finish_reason):
            print(f"RAW LLM OUTPUT (overall):\n{candidate}\nFinish reason: {finish_reason}")
            acc = original_acceptable(candidate, finish_reason)
            print(f"Accepted overall? {acc}")
            return acc
            
        kwargs['is_acceptable'] = patched_acceptable
        return original_complete(*args, **kwargs)
        
    llm_provider_service._complete_with_retries = mocked_complete
    
    res = llm_provider_service.generate_overall_summary(
        dim_scores=dim_scores,
        contract_version="5.0"
    )
    print(f"Final Overall Result: {res}\n")
    llm_provider_service._complete_with_retries = original_complete

def test_dimension():
    print("Testing dimension...")
    original_complete = llm_provider_service._complete_with_retries
    
    def mocked_complete(*args, **kwargs):
        original_acceptable = kwargs['is_acceptable']
        def patched_acceptable(candidate, finish_reason):
            print(f"RAW LLM OUTPUT (dimension):\n{candidate}\nFinish reason: {finish_reason}")
            
            # Let's debug why it fails
            is_heb = llm_provider_service.is_complete_hebrew_copy(candidate, contract_version="5.0")
            print(f"is_complete_hebrew_copy? {is_heb}")
            if not is_heb:
                heb_only = llm_provider_service.is_hebrew_only_copy(candidate)
                print(f"is_hebrew_only_copy? {heb_only}")
                _COMPLETE_SENTENCE_PATTERN = re.compile(r"[^.!?؟]+[.!?؟]")
                sentences = _COMPLETE_SENTENCE_PATTERN.findall(candidate.strip())
                print(f"sentences: {sentences}")
                compact_sentences = re.sub(r"\s", "", "".join(sentences))
                compact_text = re.sub(r"\s", "", candidate.strip())
                print(f"compact_sentences: {compact_sentences}")
                print(f"compact_text:      {compact_text}")
                
            dist_counts = llm_provider_service.distribution_counts([])
            is_consistent = llm_provider_service.is_status_consistent(candidate, "red", "5.0", dist_counts)
            print(f"is_status_consistent? {is_consistent}")
            
            acc = original_acceptable(candidate, finish_reason)
            print(f"Accepted dimension? {acc}")
            return acc
            
        kwargs['is_acceptable'] = patched_acceptable
        return original_complete(*args, **kwargs)
        
    llm_provider_service._complete_with_retries = mocked_complete
    
    res = llm_provider_service.generate_psychological_interpretation_result(
        dim_id="balance",
        dim_hebrew="איזון",
        score=45.0,
        status="red",
        contract_version="5.0",
        question_aggregates=[
            {"questionId": "q1", "questionText": "hello", "averageScore": 45.0, "responseCount": 10, "scoreDistribution": {"green":2, "yellow":3, "red":5}}
        ]
    )
    print(f"Final Dimension Result: {res}")
    llm_provider_service._complete_with_retries = original_complete

test_overall()
test_dimension()
