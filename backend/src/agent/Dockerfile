FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# Defaults for local `docker build`; CDK passes --build-arg from .env via AgentEcrConstruct.
ARG AWS_REGION=us-west-2
ARG LOG_LEVEL=INFO

WORKDIR /app

# ────────────────────────────────────────────────────────────────────────
# Environment Variables
# ────────────────────────────────────────────────────────────────────────
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_NO_PROGRESS=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DOCKER_CONTAINER=1 \
    AWS_REGION=${AWS_REGION} \
    AWS_DEFAULT_REGION=${AWS_REGION} \
    LOG_LEVEL=${LOG_LEVEL}

# ────────────────────────────────────────────────────────────────────────
# Install Python Dependencies
# ────────────────────────────────────────────────────────────────────────
COPY requirements.txt requirements.txt
RUN uv pip install -r requirements.txt

RUN uv pip install aws-opentelemetry-distro==0.12.2

# ────────────────────────────────────────────────────────────────────────
# Create Non-Root User (Security Best Practice)
# ────────────────────────────────────────────────────────────────────────
RUN useradd -m -u 1000 agentuser

# ────────────────────────────────────────────────────────────────────────
# Copy Agent Source Code
# ────────────────────────────────────────────────────────────────────────
COPY --chown=agentuser:agentuser __init__.py /app/agent/__init__.py
COPY --chown=agentuser:agentuser main.py /app/agent/main.py
COPY --chown=agentuser:agentuser supervisor/ /app/agent/supervisor/
COPY --chown=agentuser:agentuser monitoring/ /app/agent/monitoring/
COPY --chown=agentuser:agentuser websearch/ /app/agent/websearch/
COPY --chown=agentuser:agentuser common/ /app/agent/common/

# ────────────────────────────────────────────────────────────────────────
# Switch to Non-Root User
# ────────────────────────────────────────────────────────────────────────
USER agentuser

# ────────────────────────────────────────────────────────────────────────
# Expose Ports (AgentCore Runtime)
# ────────────────────────────────────────────────────────────────────────
EXPOSE 9000
EXPOSE 8000
EXPOSE 8080

# ────────────────────────────────────────────────────────────────────────
# Health Check (Optional, for local testing)
# ────────────────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import sys; sys.exit(0)"

# ────────────────────────────────────────────────────────────────────────
# Entry Point
# ────────────────────────────────────────────────────────────────────────
CMD ["opentelemetry-instrument", "python", "-m", "agent.main"]
