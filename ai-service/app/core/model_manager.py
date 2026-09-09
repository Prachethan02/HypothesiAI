"""
Model Lifecycle & Resource-Aware Manager — Stage 20
===================================================
Thread-safe singleton registry for neural and NLP models.
Provides memory-conscious lazy loading, device detection, and graceful CPU/heuristic fallbacks.
"""
import os
import threading
from typing import Any, Dict, Optional
try:
    import psutil
except ImportError:
    psutil = None
from app.core.config import settings
from app.core.logging import logger


class ModelManager:
    """Thread-safe resource-aware model manager for neural components."""
    
    _instance: Optional["ModelManager"] = None
    _lock: threading.Lock = threading.Lock()
    
    def __new__(cls) -> "ModelManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelManager, cls).__new__(cls)
                cls._instance._models: Dict[str, Any] = {}
                cls._instance._device: Optional[str] = None
                cls._instance._init_environment()
            return cls._instance
            
    def _init_environment(self) -> None:
        """Create model cache directory and determine computation device."""
        os.makedirs(settings.MODEL_CACHE_DIR, exist_ok=True)
        self._device = self._resolve_device()
        logger.info(f"[ModelManager] Resolved compute device: {self._device}")
        
    def _resolve_device(self) -> str:
        """Resolve target device ('cuda', 'mps', 'cpu') based on hardware availability."""
        if settings.DEVICE != "auto":
            return settings.DEVICE
            
        try:
            import torch
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                logger.info(f"[ModelManager] GPU detected: {gpu_name}")
                return "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
            
        return "cpu"
        
    def get_device(self) -> str:
        return self._device or "cpu"
        
    def get_system_resources(self) -> Dict[str, Any]:
        """Collect real-time RAM and CPU metrics."""
        total_ram = round(psutil.virtual_memory().total / (1024 * 1024), 1) if psutil else 4096.0
        avail_ram = round(psutil.virtual_memory().available / (1024 * 1024), 1) if psutil else 2048.0
        ram_pct = psutil.virtual_memory().percent if psutil else 50.0
        cpu_pct = psutil.cpu_percent(interval=None) if psutil else 0.0
        cpu_count = psutil.cpu_count(logical=True) if psutil else os.cpu_count() or 4
        
        gpu_info: Dict[str, Any] = {"available": False}
        try:
            import torch
            if torch.cuda.is_available():
                gpu_info = {
                    "available": True,
                    "device_name": torch.cuda.get_device_name(0),
                    "memory_allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2),
                    "memory_reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 2),
                }
        except ImportError:
            pass
            
        return {
            "total_ram_mb": total_ram,
            "available_ram_mb": avail_ram,
            "ram_used_percent": ram_pct,
            "cpu_percent": cpu_pct,
            "cpu_count": cpu_count,
            "device": self.get_device(),
            "gpu": gpu_info,
            "loaded_models": list(self._models.keys()),
        }

    def get_or_load_embedding_model(self) -> Any:
        """Thread-safe retrieval or lazy instantiation of the sentence embedding model."""
        key = f"embedding_{settings.EMBEDDING_MODEL_NAME}"
        with self._lock:
            if key in self._models:
                return self._models[key]
                
            logger.info(f"[ModelManager] Loading embedding model '{settings.EMBEDDING_MODEL_NAME}' onto {self.get_device()}...")
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer(
                    settings.EMBEDDING_MODEL_NAME,
                    cache_folder=settings.MODEL_CACHE_DIR,
                    device=self.get_device(),
                )
                self._models[key] = model
                logger.info(f"[ModelManager] Successfully loaded {settings.EMBEDDING_MODEL_NAME}")
                return model
            except Exception as err:
                logger.warn(f"[ModelManager] Failed to load SentenceTransformer ({err}). Using fallback mode.")
                if not settings.ENABLE_NEURAL_FALLBACK:
                    raise
                return None

    def get_or_load_nli_model(self) -> Any:
        """Thread-safe retrieval or lazy instantiation of the NLI CrossEncoder model."""
        key = f"nli_{settings.NLI_MODEL_NAME}"
        with self._lock:
            if key in self._models:
                return self._models[key]
                
            logger.info(f"[ModelManager] Loading NLI model '{settings.NLI_MODEL_NAME}' onto {self.get_device()}...")
            try:
                from sentence_transformers import CrossEncoder
                model = CrossEncoder(
                    settings.NLI_MODEL_NAME,
                    device=self.get_device(),
                )
                self._models[key] = model
                logger.info(f"[ModelManager] Successfully loaded NLI model {settings.NLI_MODEL_NAME}")
                return model
            except Exception as err:
                logger.warn(f"[ModelManager] Failed to load CrossEncoder ({err}). Using heuristic NLI fallback.")
                if not settings.ENABLE_NEURAL_FALLBACK:
                    raise
                return None

    def unload_model(self, key_prefix: str) -> None:
        """Free memory for specific model keys."""
        with self._lock:
            for k in list(self._models.keys()):
                if key_prefix in k:
                    del self._models[k]
                    logger.info(f"[ModelManager] Unloaded model: {k}")


# Global singleton instance
model_manager = ModelManager()
