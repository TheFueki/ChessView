from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_compose_defines_redis_and_passes_backend_redis_url():
    compose_text = (PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "  redis:" in compose_text
    assert "image: redis:" in compose_text
    assert "REDIS_URL: ${DOCKER_REDIS_URL}" in compose_text
    assert "redis:" in compose_text
    assert "condition: service_healthy" in compose_text


def test_env_example_documents_local_and_docker_redis_urls():
    env_text = (PROJECT_ROOT / ".env.example").read_text(encoding="utf-8")

    assert "REDIS_URL=redis://localhost:6379/0" in env_text
    assert "DOCKER_REDIS_URL=redis://redis:6379/0" in env_text


def test_pr_ci_provisions_redis_for_backend_job():
    workflow_text = (PROJECT_ROOT / ".github" / "workflows" / "pr-ci.yml").read_text(encoding="utf-8")

    assert "redis:" in workflow_text
    assert "image: redis:" in workflow_text
    assert "6379:6379" in workflow_text
    assert "REDIS_URL: redis://localhost:6379/0" in workflow_text


def test_frontend_websocket_proxy_targets_backend_container_in_docker_compose():
    compose_text = (PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "VITE_WS_PROXY_TARGET: ws://backend:8000" in compose_text


def test_frontend_chat_history_uses_mounted_communication_api_prefix():
    chat_model_text = (
        PROJECT_ROOT / "frontend" / "src" / "features" / "send-chat-message" / "model.ts"
    ).read_text(encoding="utf-8")

    assert "`/chat/${gameId}/messages`" in chat_model_text


def test_shop_page_purchase_controls_use_backend_inventory():
    shop_page_text = (
        PROJECT_ROOT / "frontend" / "src" / "pages" / "shop-page" / "ShopPage.tsx"
    ).read_text(encoding="utf-8")

    assert "useShopInventory" in shop_page_text
    assert "/shop/items/${itemId}/purchase" in shop_page_text
    assert "/shop/items/${itemId}/equip" in shop_page_text
    assert "localStorage" not in shop_page_text
    assert "spentCoins" not in shop_page_text
    assert "Owned" in shop_page_text


def test_clubs_page_search_create_and_details_are_interactive():
    clubs_page_text = (
        PROJECT_ROOT / "frontend" / "src" / "pages" / "clubs-page" / "ClubsPage.tsx"
    ).read_text(encoding="utf-8")

    assert 'http.get<ClubResponse[]>("/clubs")' in clubs_page_text
    assert 'http.post<ClubResponse>("/clubs"' in clubs_page_text
    assert '`/clubs/${clubId}/join`' in clubs_page_text
    assert "http.delete<ClubResponse>(`/clubs/${clubId}/join`)" in clubs_page_text
    assert "filteredClubs" in clubs_page_text
    assert "selectedClub" in clubs_page_text
    assert "value={query}" in clubs_page_text
    assert "No clubs match" in clubs_page_text


def test_logout_uses_one_shot_home_redirect_marker():
    app_shell_text = (
        PROJECT_ROOT / "frontend" / "src" / "widgets" / "app-shell" / "AppShell.tsx"
    ).read_text(encoding="utf-8")
    router_text = (PROJECT_ROOT / "frontend" / "src" / "app" / "router.tsx").read_text(encoding="utf-8")
    auth_redirect_text = (
        PROJECT_ROOT / "frontend" / "src" / "shared" / "lib" / "authRedirect.ts"
    ).read_text(encoding="utf-8")

    assert "beginLogoutRedirect()" in app_shell_text
    assert "hasLogoutRedirect()" in router_text
    assert "clearLogoutRedirect()" in router_text
    assert "chessview-logout-redirect" in auth_redirect_text


def test_scheduled_matches_page_hides_invalid_status_actions():
    scheduled_page_text = (
        PROJECT_ROOT / "frontend" / "src" / "pages" / "scheduled-matches-page" / "ScheduledMatchesPage.tsx"
    ).read_text(encoding="utf-8")

    assert "canAcceptMatch" in scheduled_page_text
    assert "canDeclineMatch" in scheduled_page_text
    assert "canStartMatch" in scheduled_page_text
    assert "canPayForMatch" in scheduled_page_text
    assert "match.status === \"pending_acceptance\"" in scheduled_page_text
    assert "startableStatuses" in scheduled_page_text
