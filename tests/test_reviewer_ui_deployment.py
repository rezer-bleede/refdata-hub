"""Tests for Reviewer UI deployment artefacts."""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
NGINX_CONF = REPO_ROOT / "reviewer-ui" / "nginx" / "default.conf"
DOCKERFILE = REPO_ROOT / "reviewer-ui" / "Dockerfile"
DOCKER_COMPOSE = REPO_ROOT / "docker-compose.yml"


def test_nginx_config_has_history_fallback() -> None:
    """Ensure Nginx rewrites unknown routes to index.html for the SPA."""

    config_text = NGINX_CONF.read_text(encoding="utf-8")
    assert "try_files $uri $uri/ /index.html;" in config_text
    assert "location / {" in config_text


@pytest.mark.integration
def test_dockerfile_copies_custom_nginx_config() -> None:
    """The Dockerfile should ship the custom Nginx config into the runtime image."""

    dockerfile_text = DOCKERFILE.read_text(encoding="utf-8")
    assert "COPY nginx/default.conf /etc/nginx/conf.d/default.conf" in dockerfile_text


def test_docker_compose_uses_browser_accessible_api_host() -> None:
    """The docker-compose build arg must target localhost for browser fetches."""

    compose_text = DOCKER_COMPOSE.read_text(encoding="utf-8")
    assert "VITE_API_BASE_URL: http://localhost:8000" in compose_text
