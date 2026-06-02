from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


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

    assert "filteredClubs" in clubs_page_text
    assert "createClub" in clubs_page_text
    assert "selectedClub" in clubs_page_text
    assert "selectedClubIsVisible" in clubs_page_text
    assert "onClick={createClub}" in clubs_page_text
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
