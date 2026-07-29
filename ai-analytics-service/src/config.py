import ipaddress
import os
from urllib.parse import urlsplit

LLM_PROVIDER_KEY_ENV = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}
SUPPORTED_LLM_PROVIDERS = frozenset(LLM_PROVIDER_KEY_ENV)


def _is_invalid_url(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        return parsed.scheme not in {"http", "https"} or not parsed.hostname
    except ValueError:
        return True


def _is_loopback_url(url: str) -> bool:
    try:
        hostname = urlsplit(url).hostname
    except ValueError:
        return False

    if not hostname:
        return False

    hostname = hostname.lower().rstrip(".")
    if hostname == "localhost":
        return True

    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False


def _is_local_or_invalid_url(url: str) -> bool:
    return _is_invalid_url(url) or _is_loopback_url(url)


def _select_llm_api_key(
    explicit_provider: str,
) -> tuple[str, str, str, str]:
    generic_key = os.getenv("LLM_API_KEY", "")
    if generic_key:
        return generic_key, "LLM_API_KEY", "", ""

    configured_provider_keys = [
        (provider, env_name, os.getenv(env_name, ""))
        for provider, env_name in LLM_PROVIDER_KEY_ENV.items()
        if os.getenv(env_name, "")
    ]

    if explicit_provider in LLM_PROVIDER_KEY_ENV:
        explicit_env_name = LLM_PROVIDER_KEY_ENV[explicit_provider]
        explicit_key = os.getenv(explicit_env_name, "")
        if explicit_key:
            return (
                explicit_key,
                explicit_env_name,
                explicit_provider,
                "",
            )

    if len(configured_provider_keys) == 1:
        provider, env_name, api_key = configured_provider_keys[0]
        return api_key, env_name, provider, ""

    if len(configured_provider_keys) > 1:
        key_names = ", ".join(
            env_name for _, env_name, _ in configured_provider_keys
        )
        return (
            "",
            "",
            "",
            "Multiple provider-specific API keys are configured "
            f"({key_names}); set LLM_PROVIDER or use LLM_API_KEY.",
        )

    return "", "", "", ""


class Settings:
    def __init__(self):
        self.app_name: str = "Shalomut AI Analytics Microservice"
        self.port: int = int(os.getenv("PORT", "8000"))
        self.host: str = os.getenv("HOST", "0.0.0.0")
        # Fail closed: development mode disables the mandatory webhook secret,
        # so it must be opted into explicitly instead of being the fallback for
        # any runtime that does not set ENV (containers, VMs, CI).
        # `local` is the local environment: strict like the deployment, except
        # that its Data Layer is on loopback. See runtime_configuration_errors.
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
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "")
        self.llm_provider: str = os.getenv(
            "LLM_PROVIDER",
            "auto",
        ).strip().lower()
        (
            self.llm_api_key,
            self.llm_key_source,
            self.llm_key_provider,
            self.llm_key_configuration_error,
        ) = _select_llm_api_key(self.llm_provider)

        default_model_fast = "gpt-4o-mini"
        default_model_heavy = "gpt-4o"
        if self.resolved_llm_provider() == "gemini":
            default_model_fast = "gemini-flash-latest"
            default_model_heavy = "gemini-pro-latest"

        # Fast & Cheap model for 95% of tasks
        self.llm_model_fast: str = (
            os.getenv("LLM_MODEL_FAST")
            or os.getenv("OPENAI_MODEL_FAST")
            or default_model_fast
        )
        # Heavy model reserved exclusively for complex safety validation retries
        self.llm_model_heavy: str = (
            os.getenv("LLM_MODEL_HEAVY")
            or os.getenv("OPENAI_MODEL_HEAVY")
            or default_model_heavy
        )

        # Token cap for one interpretation. It is not the length of the answer:
        # a reasoning model spends this budget on thinking first and writes the
        # answer from what is left. Measured on gemini-flash-latest, 2026-07-28:
        # one interpretation cost 1440 thinking tokens and 108 visible ones, so
        # the old caps of 180 and 420 were spent entirely on thinking and every
        # dimension came back finish_reason "length" with no answer at all —
        # which the validator rejects, and the round silently reads as if the
        # model had never been called. Lower this only against a measurement.
        self.max_tokens_per_dimension: int = int(os.getenv("MAX_TOKENS_PER_DIMENSION", "2048"))
        # Token Saving: Only invoke LLM for problematic ('yellow' / 'red') dimensions
        self.only_llm_for_problematic: bool = os.getenv("ONLY_LLM_FOR_PROBLEMATIC", "true").lower() == "true"
        # Transient provider failures are retried inside the worker thread.
        # The defaults bound how long one dimension may hold a provider slot;
        # since the webhook answers 202 before the run starts, they no longer
        # have to fit the core app's 30-second timeout.
        self.llm_max_attempts: int = max(
            1,
            min(5, int(os.getenv("LLM_MAX_ATTEMPTS", "3"))),
        )
        self.llm_retry_base_delay_seconds: float = max(
            0.0,
            float(os.getenv("LLM_RETRY_BASE_DELAY_SECONDS", "0.5")),
        )
        self.llm_retry_max_delay_seconds: float = max(
            0.0,
            float(os.getenv("LLM_RETRY_MAX_DELAY_SECONDS", "2.0")),
        )
        self.llm_retry_jitter_seconds: float = max(
            0.0,
            float(os.getenv("LLM_RETRY_JITTER_SECONDS", "0.25")),
        )
        # Bounds one dimension's whole retry loop. Values above 25 seconds are
        # capped.
        self.llm_retry_budget_seconds: float = max(
            1.0,
            min(
                25.0,
                float(os.getenv("LLM_RETRY_BUDGET_SECONDS", "25.0")),
            ),
        )
        self.llm_request_timeout_seconds: float = max(
            1.0,
            min(
                self.llm_retry_budget_seconds,
                float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "20.0")),
            ),
        )
        self.llm_min_retry_window_seconds: float = max(
            1.0,
            min(
                self.llm_retry_budget_seconds,
                float(os.getenv("LLM_MIN_RETRY_WINDOW_SECONDS", "8.0")),
            ),
        )
        # How many provider requests one round may have in flight. A round is
        # roughly 33 calls and both LLM nodes gather their whole batch at once,
        # so without a bound a free tier sees eight interpretations, then two
        # dozen adaptations, arrive together and answers 429 to most of them.
        # Two is what the strictest free tier allows concurrently; raise it for
        # a paid key. Waiting for a slot happens before the request starts, so
        # it never eats into the per-dimension retry budget.
        self.llm_max_concurrent_requests: int = max(
            1,
            int(os.getenv("LLM_MAX_CONCURRENT_REQUESTS", "2")),
        )
        
        # Reserved persistence setting for a future vector-backed catalog.
        self.chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        
        # Privacy Constraint.
        # Ten respondents is the product requirement, in Core and here alike,
        # and the threshold always arrives on the payload as
        # `privacyThreshold`. This value is only the fallback for a payload
        # that omits it, and it mirrors the same requirement so that neither
        # service can be the lenient one.
        self.privacy_threshold: int = int(os.getenv("PRIVACY_THRESHOLD", "10"))

    def resolved_llm_provider(self, model_name: str = "") -> str:
        if self.llm_provider != "auto":
            return self.llm_provider

        if self.llm_key_provider:
            return self.llm_key_provider

        if (
            self.llm_api_key.startswith("AIzaSy")
            or self.llm_api_key.startswith("AQ.")
        ):
            return "gemini"

        if self.llm_api_key.startswith("sk-or-v1-"):
            return "openrouter"

        if model_name.lower().startswith("gemini"):
            return "gemini"

        return "openai"

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
        """Everything that must hold before this instance may run a round.

        Three modes, and only three: `development` for tests and throwaway
        runs, `local` for the local environment, anything else for the deployed
        one. `local` differs from the deployed mode in exactly one point — the
        core app it talks to lives on loopback — so every other rule, including
        the three shared secrets and the ban on mock MCP, applies unchanged.
        That is the point: a local run has to fail on the same misconfiguration
        the deployment would fail on.
        """
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
            if self.env == "local":
                if _is_invalid_url(value):
                    errors.append(
                        f"{name} must use a valid http(s) Data Layer URL"
                    )
            elif _is_local_or_invalid_url(value):
                errors.append(
                    f"{name} must use a valid non-local Data Layer URL "
                    "outside development"
                )

        if self.use_mock_mcp:
            errors.append("USE_MOCK_MCP must be false outside development")

        if self.llm_key_configuration_error:
            errors.append(self.llm_key_configuration_error)

        if (
            self.llm_api_key
            and self.llm_key_source == "LLM_API_KEY"
            and self.llm_provider == "auto"
            and not self.llm_base_url
        ):
            errors.append(
                "LLM_PROVIDER or LLM_BASE_URL is required outside "
                "development when LLM_API_KEY is used."
            )

        if (
            self.llm_api_key
            and self.llm_provider != "auto"
            and self.llm_provider not in SUPPORTED_LLM_PROVIDERS
            and not self.llm_base_url
        ):
            errors.append(
                f"Unsupported LLM_PROVIDER '{self.llm_provider}'; "
                "configure LLM_BASE_URL for a custom provider."
            )

        return errors

settings = Settings()
