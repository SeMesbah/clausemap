"""
Shared exception types for the Clausemap application layer.
"""


class LLMUnavailableError(Exception):
    """Raised when every page fails due to an LLM auth, quota or connectivity issue."""
