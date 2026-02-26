"""Tests for Reviewer UI deployment artefacts."""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
NGINX_CONF = REPO_ROOT / "reviewer-ui" / "nginx" / "default.conf"
DOCKERFILE = REPO_ROOT / "reviewer-ui" / "Dockerfile"
DOCKER_COMPOSE = REPO_ROOT / "docker-compose.yml"
CF_REDIRECTS = REPO_ROOT / "reviewer-ui" / "public" / "_redirects"
WRANGLER_CONFIG = REPO_ROOT / "reviewer-ui" / "wrangler.toml"


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


def test_cloudflare_redirects_has_history_fallback() -> None:
    """Cloudflare Pages should rewrite unknown routes to index.html for SPA routing."""

    redirects_text = CF_REDIRECTS.read_text(encoding="utf-8")
    assert "/* /index.html 200" in redirects_text


def test_wrangler_config_exposes_pages_and_api_env_defaults() -> None:
    """Wrangler config should include Pages build output and same-origin API defaults."""

    wrangler_text = WRANGLER_CONFIG.read_text(encoding="utf-8")
    assert 'pages_build_output_dir = "dist"' in wrangler_text
    assert 'VITE_API_BASE_URL = "/api"' in wrangler_text
    assert 'COMPANION_TIMEOUT_MS = "20000"' in wrangler_text
