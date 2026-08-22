from src.contracts import AI_ANALYTICS_V4_CONTRACT_VERSION, AI_ANALYTICS_V5_CONTRACT_VERSION, AI_ANALYTICS_CONTRACT_VERSION
import ipaddress
import os
from urllib.parse import urlsplit

LLM_PROVIDER_KEY_ENV = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}
SUPPORTED_LLM_PROVIDERS = frozenset(LLM_PROVIDER_KEY_ENV)

# What `reasoning_effort` may say. The list is the OpenAI-compatible one Gemini
# documents for this surface; `none` is accepted by its 2.5 models only, and a
# model that refuses a value on the list says so itself. What this frozenset is
# for is the word that is on no provider's list at all.
SUPPORTED_REASONING_EFFORTS = frozenset(
    {"none", "minimal", "low", "medium", "high"}
)


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
        # Durable Core-owned jobs are consumed by the polling worker. It is an
        # explicit rollout switch so the worker can be deployed before Core
        # starts exposing the queue without changing the legacy webhook path.
        self.ai_job_polling_enabled: bool = (
            os.getenv("AI_JOB_POLLING_ENABLED", "false").lower() == "true"
        )
        self.ai_job_poll_interval_seconds: float = max(
            0.2,
            min(60.0, float(os.getenv("AI_JOB_POLL_INTERVAL_SECONDS", "2.0"))),
        )
        # How far apart the polls drift while the queue stays empty, which is
        # the ordinary state: rounds close a few times a day, and every poll in
        # between costs Core a serverless invocation and two queries to answer
        # `204`. The interval above is what a worker uses when there is work;
        # after an empty poll the wait doubles up to this ceiling and snaps
        # back to the interval the moment a job is claimed. At 2 s → 30 s that
        # is about 2 900 polls a day instead of 43 000, and it is charged per
        # slot, since every lane of `AI_JOB_POOL_SIZE` polls on its own.
        #
        # What it costs is up to one ceiling of delay before the first round of
        # a quiet stretch starts — invisible next to an analysis of about three
        # minutes that nothing notifies the manager about anyway. Setting it to
        # the poll interval restores the old flat cadence; it can never be less,
        # because a ceiling below the base would only be read as one.
        self.ai_job_poll_max_interval_seconds: float = max(
            self.ai_job_poll_interval_seconds,
            min(
                300.0,
                float(os.getenv("AI_JOB_POLL_MAX_INTERVAL_SECONDS", "30.0")),
            ),
        )
        # Core leases for 90 seconds. Capping heartbeats at 60 seconds leaves a
        # full retry window even when one renewal is delayed — a window
        # `AiAnalysisJobWorker` spends: a renewal it could not send is retried,
        # and the run is released only once the lease itself has run out.
        self.ai_job_heartbeat_interval_seconds: float = max(
            1.0,
            min(
                60.0,
                float(os.getenv("AI_JOB_HEARTBEAT_INTERVAL_SECONDS", "30.0")),
            ),
        )
        # How many rounds this process analyses at once, each holding its own
        # lease. One is the shape the service ran in until 2026-08-18: claim,
        # finish, claim again — so fifty schools closing together queued behind
        # one another for hours, while the account's paid quota sat mostly idle.
        # A round is about 28 provider calls over roughly three minutes, near
        # 11 a minute against a pace of 60, so the process spends most of a
        # round waiting on an answer rather than on its own rate limit. The
        # slots that wait are what this fills.
        #
        # Raising it is safe because the pace is charged per process, not per
        # round: `provider_rate_limiter` is one module-level object behind a
        # lock, so every concurrent round books turns from the same queue and
        # the account's quota is spent once. That is exactly what a second
        # container would *not* give — two processes would keep two private
        # counters and together exceed the quota — which is why this knob comes
        # before that one.
        #
        # The ceiling is 10 rather than unbounded: past roughly 60/11 the pace
        # is the binding limit and further slots only queue behind it, and each
        # concurrent round also holds a lease Core must keep alive. The default
        # stays 1 so a deployment changes behaviour only when it says so.
        self.ai_job_pool_size: int = max(
            1,
            min(10, int(os.getenv("AI_JOB_POOL_SIZE", "1"))),
        )

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

        # How much of that cap the model may spend on thinking, which is a
        # separate question from how large the cap is. Thinking tokens are
        # billed at the output rate — on `gemini-3.5-flash` $9 per million
        # against $1.50 for input — and the interpretation measured on
        # 2026-07-28 spent 1440 of them against 108 visible ones. The cap below
        # bounds what one answer may cost; this bounds what it does cost, which
        # is the larger half of every bill this service has produced.
        #
        # Unset sends nothing and leaves the provider's own default — what every
        # round before this setting existed was charged at. Deliberate: the knob
        # that moves the bill should be the visible thing that moved it, not a
        # new default nobody chose.
        #
        # `reasoning_effort` is the OpenAI-compatible spelling, which is the
        # surface this service speaks. An unrecognised value is not forwarded —
        # it becomes a configuration error instead — so a typo costs the
        # previous behaviour rather than a `400` on every call of the round.
        self.llm_reasoning_effort: str = ""
        self.llm_reasoning_effort_configuration_error: str = ""
        configured_reasoning_effort = os.getenv(
            "LLM_REASONING_EFFORT",
            "",
        ).strip().lower()
        if configured_reasoning_effort:
            if configured_reasoning_effort in SUPPORTED_REASONING_EFFORTS:
                self.llm_reasoning_effort = configured_reasoning_effort
            else:
                self.llm_reasoning_effort_configuration_error = (
                    "Unsupported LLM_REASONING_EFFORT "
                    f"'{configured_reasoning_effort}'; use one of "
                    + ", ".join(sorted(SUPPORTED_REASONING_EFFORTS))
                    + "."
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
        # Keep the provider away from green dimensions. Default false since
        # 2026-07-30: it was a token saving from when one round did not fit in a
        # provider's day, and lite's 1000 requests a day ended that. Green now
        # gets the same paragraph the other seven get, and the deterministic
        # sentence only where the answer never came — see
        # `generate_interpretation_result`. Set it true to buy back up to five
        # requests a round at the cost of a formula in place of a strength.
        self.only_llm_for_problematic: bool = os.getenv("ONLY_LLM_FOR_PROBLEMATIC", "false").lower() == "true"
        # Transient provider failures are retried inside the worker thread.
        # The defaults bound how long one dimension may hold a provider slot;
        # since the webhook answers 202 before the run starts, they no longer
        # have to fit the core app's 30-second timeout. That was written when
        # the constraint was lifted, and the numbers below were left where the
        # constraint had put them for another three weeks — which is what the
        # ceiling further down is about.
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
        # Bounds one dimension's whole retry loop. The ceiling is what makes
        # this a code constant rather than a knob: it caps the environment
        # variable too, so while it was 25 no deployment could raise either
        # number, whatever the dashboard said.
        #
        # Measured 2026-08-19 on 6.0 with `gemini-3.5-flash` and
        # `MAX_TOKENS_PER_DIMENSION=8192`, two rounds and 55 provider calls.
        # Round one: median 17.8s, p90 22.6s, slowest 26.0s. Round two: median
        # 21.0s, slowest **50.9s**. The same work on the same settings, and the
        # slowest call nearly doubled between them — which is the number that
        # decides this, because a timeout is sized against the tail and not
        # against the median.
        #
        # The old twenty seconds sat below even the median. Seven of eight
        # adaptations died on `TimeoutError` while the round reported success;
        # at the 25s ceiling ten of twenty-seven calls still died. A reasoning
        # model writing five recommendations in one request is a twenty-to-fifty
        # second job and was being given twenty.
        #
        # Ninety is 1.8x the slowest call actually seen, chosen after sixty
        # turned out to be 1.2x it — one round is not a distribution, and the
        # first estimate here was made from one round. Three hundred lets all
        # three attempts run to ninety with their delays (3x90 + ~7 < 300),
        # rather than having the budget kill an attempt the timeout would have
        # allowed: that is this same defect one level down.
        #
        # The ceiling is raised, not removed. It is what makes these code
        # constants rather than knobs — it caps the environment variable too, so
        # while it was 25 no deployment could lift either number, whatever was
        # set on the dashboard. The cost of the larger numbers is worst-case
        # wall time against a hung provider, roughly twelve times what it was.
        # That is bounded, asynchronous behind the webhook's 202, and preferable
        # to losing seven adaptations on every round with certainty.
        #
        # Corroborated from the other direction on 2026-08-19: the eval corpus
        # at `LLM_REASONING_EFFORT=low` lost three of 56 stones to
        # `TimeoutError` at `structured_summary` while the graders showed no
        # drop in what the model wrote. Waiting for those answers cost 67% less
        # than an unset round, so the saving that setting offers is only real
        # once a slow answer is retried rather than abandoned.
        self.llm_retry_budget_seconds: float = max(
            1.0,
            min(
                600.0,
                float(os.getenv("LLM_RETRY_BUDGET_SECONDS", "300.0")),
            ),
        )
        self.llm_request_timeout_seconds: float = max(
            1.0,
            min(
                self.llm_retry_budget_seconds,
                float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "90.0")),
            ),
        )
        # What the next attempt must be able to keep to be worth starting. A
        # retry booked with less time than this gets a request timeout of
        # whatever is left, so the old 8 bought an attempt that was almost
        # certain to time out again — the failure this raise is about. Twenty is
        # about the median call measured on 2026-08-19 (17.8s and 21.0s over two
        # rounds), not a fraction of the 90-second timeout: an attempt given
        # twenty seconds can still finish a typical answer, and one given eight
        # could not finish any of them. With a 300-second budget and three
        # attempts of ninety, this bound rarely binds at all; it exists for the
        # round that has already spent most of its budget.
        self.llm_min_retry_window_seconds: float = max(
            1.0,
            min(
                self.llm_retry_budget_seconds,
                float(os.getenv("LLM_MIN_RETRY_WINDOW_SECONDS", "20.0")),
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
        # How fast the whole process may reach the provider. The bound above
        # answers only how many requests are in flight; a free tier also counts
        # how many arrive per minute, and seventeen of them passed two at a time
        # through an unpaced round still land inside one — which is what every
        # live round has been dying of.
        #
        # The default is the strictest free tier there is (five a minute, one
        # request every twelve seconds), because an environment that says
        # nothing about its quota should not be assumed to have a generous one.
        # What the deployment actually runs is in `render.yaml`, next to the
        # model it belongs to: rates are counted per model, so the number is
        # only meaningful beside the name. Nobody waits on either — the webhook
        # answered `202` long before, and Core reads a run as stalled only
        # after fifteen minutes. Zero turns the pace off.
        self.llm_max_requests_per_minute: float = max(
            0.0,
            float(os.getenv("LLM_MAX_REQUESTS_PER_MINUTE", "5")),
        )
        # The pace for the heavy tier, and it is a separate number because the
        # quota is separate. The setting above belongs to `LLM_MODEL_FAST` and
        # is tuned to that model's tier; the heavy model has a tier of its own,
        # and a replay switches to it, so borrowing the fast number sends the
        # replay at several times what the heavy tier allows — every live
        # round's original `429`, moved into the path that only opens when the
        # round is already in trouble. A replay is narrow now, but the number
        # still has to belong to the model it is counted against.
        #
        # Unset means the strictest free tier, deliberately rather than
        # inheriting the fast number: inheritance would rebuild the defect the
        # next time the fast pace was raised, which is precisely how it arose.
        self.llm_max_requests_per_minute_heavy: float = max(
            0.0,
            float(os.getenv("LLM_MAX_REQUESTS_PER_MINUTE_HEAVY", "5")),
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

    def requests_per_minute_for(self, model_name: str) -> float:
        """How fast this process may reach one named model. Zero means unpaced.

        Every rate here is per model because that is the unit the provider
        counts in, so the model name is the whole question. A name configured
        on both tiers gets the stricter of the two — pointing `LLM_MODEL_HEAVY`
        at the fast model is a reasonable way to run this service, and it must
        buy one budget rather than two. A name on neither tier gets the
        strictest pace on the key, for the same reason the defaults are strict:
        an unknown quota is not an absent one.
        """
        rates = []
        if model_name and model_name == self.llm_model_fast:
            rates.append(self.llm_max_requests_per_minute)
        if model_name and model_name == self.llm_model_heavy:
            rates.append(self.llm_max_requests_per_minute_heavy)
        if not rates:
            rates = [
                self.llm_max_requests_per_minute,
                self.llm_max_requests_per_minute_heavy,
            ]

        # Zero is "no limit", so it cannot join a comparison that is looking
        # for the strictest number: an unpaced fast tier must not read as the
        # tightest bound on the key.
        paced = [rate for rate in rates if rate > 0.0]
        return min(paced) if paced else 0.0

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

        if self.llm_reasoning_effort_configuration_error:
            errors.append(self.llm_reasoning_effort_configuration_error)

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
