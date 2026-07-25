import ipaddress
import os
from urllib.parse import urlsplit


def _is_local_or_invalid_url(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return True

        hostname = parsed.hostname.lower().rstrip(".")
        if hostname == "localhost":
            return True

        try:
            return ipaddress.ip_address(hostname).is_loopback
        except ValueError:
            return False
    except ValueError:
        return True

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
        self.llm_api_key: str = (
            os.getenv("LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or ""
        )
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "")
        self.llm_provider: str = os.getenv("LLM_PROVIDER", "auto").lower()

        # Fast & Cheap model for 95% of tasks
        self.llm_model_fast: str = (
            os.getenv("LLM_MODEL_FAST")
            or os.getenv("OPENAI_MODEL_FAST")
            or "gpt-4o-mini"
        )
        # Heavy model reserved exclusively for complex safety validation retries
        self.llm_model_heavy: str = (
            os.getenv("LLM_MODEL_HEAVY")
            or os.getenv("OPENAI_MODEL_HEAVY")
            or "gpt-4o"
        )

        # Strict token caps to prevent runaway token costs
        self.max_tokens_per_dimension: int = int(os.getenv("MAX_TOKENS_PER_DIMENSION", "180"))
        # Token Saving: Only invoke LLM for problematic ('yellow' / 'red') dimensions
        self.only_llm_for_problematic: bool = os.getenv("ONLY_LLM_FOR_PROBLEMATIC", "true").lower() == "true"
        
        # Reserved persistence setting for a future vector-backed catalog.
        self.chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        
        # Privacy Constraint
        self.privacy_threshold: int = 10

    @property
    def openai_api_key(self) -> str:
        return self.llm_api_key

    @openai_api_key.setter
    def openai_api_key(self, value: str):
        self.llm_api_key = value

    @property
    def openai_model_fast(self) -> str:
        return self.llm_model_fast

    @openai_model_fast.setter
    def openai_model_fast(self, value: str):
        self.llm_model_fast = value

    @property
    def openai_model_heavy(self) -> str:
        return self.llm_model_heavy

    @openai_model_heavy.setter
    def openai_model_heavy(self, value: str):
        self.llm_model_heavy = value

    def runtime_configuration_errors(self) -> list[str]:
        if self.env == "development":
            return []

        errors = []
        required_secrets = {
            "MCP_SHARED_SECRET": self.mcp_shared_secret,
            "AI_WEBHOOK_SECRET": self.ai_webhook_secret,
            "AI_CALLBACK_SECRET": self.ai_callback_secret,
        }
        for name, value in required_secrets.items():
            if not value:
                errors.append(f"{name} is required outside development")

        required_urls = {
            "DATA_LAYER_MCP_URL": self.data_layer_mcp_url,
            "DATA_LAYER_CALLBACK_URL": self.data_layer_callback_url,
        }
        for name, value in required_urls.items():
            if _is_local_or_invalid_url(value):
                errors.append(
                    f"{name} must use a valid non-local Data Layer URL "
                    "outside development"
                )

        if self.use_mock_mcp:
            errors.append("USE_MOCK_MCP must be false outside development")

        return errors

settings = Settings()
