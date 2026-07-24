import os

class Settings:
    def __init__(self):
        self.app_name: str = "Shalomut AI Analytics Microservice"
        self.port: int = int(os.getenv("PORT", "8000"))
        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.env: str = os.getenv("ENV", "development")
        
        # Data Layer & MCP Settings
        self.data_layer_mcp_url: str = os.getenv("DATA_LAYER_MCP_URL", "http://localhost:3000/api/mcp")
        self.data_layer_callback_url: str = os.getenv("DATA_LAYER_CALLBACK_URL", "http://localhost:3000/api/rounds")
        
        # LLM Settings
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        # Vector DB
        self.chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        
        # Privacy Constraint
        self.privacy_threshold: int = 10

settings = Settings()
