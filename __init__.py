"""Model Explainer has no agent-side behaviour.

All of its work happens in desktop/plugin.js (Hermes Desktop plugin SDK). This
module exists so `hermes plugins doctor` and the validator's capability probe
can confirm that the package registers nothing: no tools, hooks, middleware,
commands or providers.
"""


def register(ctx):  # noqa: ARG001 - nothing to register
    return None
