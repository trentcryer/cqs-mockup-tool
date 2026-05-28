import tomllib
from pathlib import Path

_DEFAULTS: dict = {
    "defaults": {
        "output_dir": "output",
        "format": "jpg",
    },
    "api": {
        "timeout": 30,
        "poll_interval": 3,
        "max_polls": 20,
    },
    "favorites": {
        "product_ids": [],
    },
}


def load(config_path: Path = Path("config.toml")) -> dict:
    cfg: dict = {k: dict(v) for k, v in _DEFAULTS.items()}
    if config_path.exists():
        with open(config_path, "rb") as f:
            overrides = tomllib.load(f)
        for section, values in overrides.items():
            if section in cfg and isinstance(cfg[section], dict):
                cfg[section].update(values)
            else:
                cfg[section] = values
    return cfg
