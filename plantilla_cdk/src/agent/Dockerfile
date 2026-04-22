# ══════════════════════════════════════════════════════════════════════
# Multi-Agent Incident Response System - AgentCore Runtime Container
# ══════════════════════════════════════════════════════════════════════
# 
# Base Image: Debian 12 (Bookworm) Slim with uv package manager
# Platform: linux/arm64 (required by Bedrock AgentCore Runtime in this deployment)
# Purpose: Container for 3 Strands agents (supervisor, monitoring, websearch)
#
# ══════════════════════════════════════════════════════════════════════

FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.13-bookworm-slim

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
    AWS_REGION=us-west-2 \
    AWS_DEFAULT_REGION=us-west-2

# ────────────────────────────────────────────────────────────────────────
# Install Python Dependencies
# ────────────────────────────────────────────────────────────────────────
COPY requirements.txt requirements.txt
RUN uv pip install -r requirements.txt

# ────────────────────────────────────────────────────────────────────────
# Create Non-Root User (Security Best Practice)
# ────────────────────────────────────────────────────────────────────────
RUN useradd -m -u 1000 agentuser

# ────────────────────────────────────────────────────────────────────────
# Copy Agent Source Code
# ────────────────────────────────────────────────────────────────────────
COPY --chown=agentuser:agentuser supervisor/ /app/supervisor/
COPY --chown=agentuser:agentuser monitoring/ /app/monitoring/
COPY --chown=agentuser:agentuser websearch/ /app/websearch/
COPY --chown=agentuser:agentuser common/ /app/common/
COPY --chown=agentuser:agentuser main.py /app/main.py

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
CMD ["python3", "main.py"]
