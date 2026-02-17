import json
import os
from pathlib import Path
from typing import Optional, Dict, Any


class Settings:
    _instance = None
    _config_path = Path("data/config.json")
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Settings, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            self.load_config()  # Reload on each instantiation
            return
        self._initialized = True
        self.load_config()
    
    def load_config(self):
        """Load configuration from JSON file"""
        if self._config_path.exists():
            try:
                with open(self._config_path, 'r') as f:
                    config = json.load(f)
                    self.gemini_api_key = config.get("gemini_api_key") or ""
                    self.livekit_url = config.get("livekit_url") or ""
                    self.livekit_api_key = config.get("livekit_api_key") or ""
                    self.livekit_api_secret = config.get("livekit_api_secret") or ""
                    self.deepgram_api_key = config.get("deepgram_api_key") or ""
                    self.redis_url = config.get("redis_url", "redis://redis:6379")
                    self.embedding_model = config.get("embedding_model", "sentence-transformers/all-MiniLM-L6-v2")
                    self.chunk_size = config.get("chunk_size", 500)
                    self.chunk_overlap = config.get("chunk_overlap", 50)
            except Exception as e:
                print(f"Error loading config: {e}")
                self._set_defaults()
        else:
            self._set_defaults()
    
    def _set_defaults(self):
        """Set default values"""
        self.gemini_api_key = ""
        self.livekit_url = ""
        self.livekit_api_key = ""
        self.livekit_api_secret = ""
        self.deepgram_api_key = ""
        self.redis_url = "redis://redis:6379"
        self.embedding_model = "sentence-transformers/all-MiniLM-L6-v2"
        self.chunk_size = 500
        self.chunk_overlap = 50
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary"""
        return {
            "gemini_api_key": self.gemini_api_key or "",
            "livekit_url": self.livekit_url or "",
            "livekit_api_key": self.livekit_api_key or "",
            "livekit_api_secret": self.livekit_api_secret or "",
            "deepgram_api_key": self.deepgram_api_key or "",
            "redis_url": self.redis_url,
            "embedding_model": self.embedding_model,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap
        }
    
    def save_config(self):
        """Save current settings to JSON file"""
        os.makedirs("data", exist_ok=True)
        with open(self._config_path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)


def get_settings():
    return Settings()
