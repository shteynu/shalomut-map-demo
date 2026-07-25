import os

class Settings:
    def __init__(self):
        self.app_name: str = "Shalomut AI Analytics Microservice"
        self.port: int = int(os.getenv("PORT", "8000"))
        self.host: str = os.getenv("HOST", "0.0.0.0")
        # Fail closed: development mode disables the mandatory webhook secret,
        # so it must be opted into explicitly instead of being the fallback for
        # any runtime that does not set ENV (containers, VMs, CI).
        self.env: str = os.getenv("ENV") or os.getenv("VERCEL_ENV") or "production"
        
        # Data Layer & MCP Settings
        self.data_layer_mcp_url: str = os.getenv("DATA_LAYER_MCP_URL", "http://localhost:3000/api/mcp")
        self.data_layer_callback_url: str = os.getenv("DATA_LAYER_CALLBACK_URL", "http://localhost:3000/api/rounds")
        self.use_mock_mcp: bool = os.getenv("USE_MOCK_MCP", "false").lower() == "true"
        self.mcp_shared_secret: str = os.getenv("MCP_SHARED_SECRET", "")
        self.ai_webhook_secret: str = os.getenv("AI_WEBHOOK_SECRET", "")
        self.ai_callback_secret: str = os.getenv("AI_CALLBACK_SECRET", "")
        # Vercel Deployment Protection answers 302 to every unauthenticated
        # request, so a protected staging core app is unreachable for both
        # outbound calls unless the automation bypass travels with them.
        self.vercel_protection_bypass: str = os.getenv("VERCEL_PROTECTION_BYPASS", "")

        # LLM Settings & Token Optimization
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        # Fast & Cheap model for 95% of tasks (~15x cheaper than gpt-4o)
        self.openai_model_fast: str = os.getenv("OPENAI_MODEL_FAST", "gpt-4o-mini")
        # Heavy model reserved exclusively for complex safety validation retries
        self.openai_model_heavy: str = os.getenv("OPENAI_MODEL_HEAVY", "gpt-4o")
        # Strict token caps to prevent runaway token costs
        self.max_tokens_per_dimension: int = int(os.getenv("MAX_TOKENS_PER_DIMENSION", "180"))
        # Token Saving: Only invoke LLM for problematic ('yellow' / 'red') dimensions
        self.only_llm_for_problematic: bool = os.getenv("ONLY_LLM_FOR_PROBLEMATIC", "true").lower() == "true"
        
        # Reserved persistence setting for a future vector-backed catalog.
        self.chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        
        # Privacy Constraint
        self.privacy_threshold: int = 10

settings = Settings()
