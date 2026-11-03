"""CareFlow Structured Logging Module.

Provides standard formatted logging across application requests, lifecycles, and exceptions.
"""

import logging
import sys


def setup_logging(debug: bool = False) -> None:
    """Configures centralized logging for the CareFlow FastAPI application."""
    log_level = logging.DEBUG if debug else logging.INFO
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers on reload
    if not root_logger.handlers:
        root_logger.addHandler(handler)
    else:
        root_logger.handlers = [handler]

    # Silence overly noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
