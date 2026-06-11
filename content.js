(() => {
  if (window.__contractBrsLeaderboardLoaded) return;
  window.__contractBrsLeaderboardLoaded = true;

  const API_ORIGIN = "https://contract.tochka-urfu.tech";
  const PANEL_ID = "contract-brs-panel";
  const DEFAULT_LIMIT = 50;
  const CACHE_KEY = "contract-brs-cache-v2";
  const SYNDICATE_LABELS = {
    forge: "Forge",
    interface: "Interface",
    "qa-corps": "QA Corps",
    firewall: "Firewall",
    "neural-watch": "Neural Watch"
  };

  const state = {
    loading: false,
    teams: [],
    users: [],
    error: "",
    expanded: localStorage.getItem("contract-brs-expanded") !== "false",
    filter: "",
    lastUpdated: null
  };

  function token() {
    return localStorage.getItem("token") || "";
  }

  function headers() {
    const currentToken = token();
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  }

  async function getJson(path) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: {
        Accept: "application/json",
        ...headers()
      },
      credentials: "same-origin"
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status} ${response.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    return response.json();
  }

  function teamEntries(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.team_name || entry.title || entry.id,
      rep: entry.total_rep ?? entry.rep ?? null,
      isCurrentTeam: Boolean(entry.is_current_team)
    })).filter((entry) => entry.id);
  }

  function userEntries(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.user_name || entry.title || entry.id,
      rep: entry.rep ?? null
    })).filter((entry) => entry.id);
  }

  async function loadTeams() {
    const leaderboard = await getJson(`/api/leaderboard/teams?limit=${DEFAULT_LIMIT}`);
    const teams = teamEntries(leaderboard);
    const enriched = await Promise.all(teams.map(async (team) => {
      try {
        const [brsResult, profileResult] = await Promise.allSettled([
          getJson(`/api/teams/${encodeURIComponent(team.id)}/brs-progress`),
          getJson(`/api/teams/${encodeURIComponent(team.id)}`)
        ]);
        const brs = brsResult.status === "fulfilled" ? brsResult.value : {};
        const profile = profileResult.status === "fulfilled" ? profileResult.value : {};
        return {
          ...team,
          syndicateId: profile.syndicate_id ?? profile.syndicateId ?? null,
          credits: profile.credits ?? null,
          brsScore: brs.team_brs ?? brs.teamScore ?? brs.score ?? null,
          brsLevel: brs.team_level ?? brs.teamLevel ?? brs.level ?? null,
          done: brs.total_milestone_done ?? brs.totalDone ?? null,
          total: brs.total_milestone_total ?? brs.totalRequired ?? null,
          raw: brs,
          error: ""
        };
      } catch (error) {
        return {
          ...team,
          brsScore: null,
          brsLevel: null,
          done: null,
          total: null,
          raw: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }));
    enriched.sort((a, b) => (b.brsScore ?? -1) - (a.brsScore ?? -1));
    return enriched;
  }

  async function loadUsers() {
    const leaderboard = await getJson(`/api/leaderboard/users?limit=${DEFAULT_LIMIT}`);
    return userEntries(leaderboard);
  }

  function navigateTo(path) {
    window.location.assign(`${API_ORIGIN}${path}`);
  }

  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.teams)) return false;
      state.teams = cached.teams;
      state.users = Array.isArray(cached.users) ? cached.users : [];
      state.lastUpdated = cached.lastUpdated ? new Date(cached.lastUpdated) : null;
      return true;
    } catch {
      return false;
    }
  }

  function saveCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      teams: state.teams,
      users: state.users,
      lastUpdated: state.lastUpdated ? state.lastUpdated.toISOString() : null
    }));
  }

  function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    return new Intl.NumberFormat("ru-RU").format(Number(value));
  }

  function progressText(team) {
    if (team.done === null || team.done === undefined || team.total === null || team.total === undefined) return "";
    return `${team.done}/${team.total}`;
  }

  function syndicateLabel(id) {
    return SYNDICATE_LABELS[id] || id || "Unknown";
  }

  function syndicateIcon(team) {
    if (!team.syndicateId) return "";
    const id = escapeHtml(team.syndicateId);
    const label = escapeHtml(syndicateLabel(team.syndicateId));
    return `
      <img
        class="brs-syndicate-icon"
        src="/icons/syndicate-${id}.png"
        srcset="/icons/syndicate-${id}@2x.png 2x"
        alt="${label}"
        title="${label}"
      />
    `;
  }

  function brsIcon() {
    return `
      <svg class="brs-score-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path>
        <path d="M22 10v6"></path>
        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
      </svg>
    `;
  }

  function createPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="brs-header">
        <button class="brs-toggle" type="button" title="Collapse / expand">BRS</button>
        <div class="brs-title">
          <strong>Team BRS</strong>
          <span class="brs-subtitle">leaderboard</span>
        </div>
        <button class="brs-refresh" type="button" title="Refresh">↻</button>
      </div>
      <div class="brs-body">
        <input class="brs-search" type="search" placeholder="Filter teams" />
        <div class="brs-status"></div>
        <div class="brs-list"></div>
      </div>
    `;

    panel.querySelector(".brs-refresh").addEventListener("click", () => refresh({ force: true }));
    panel.querySelector(".brs-toggle").addEventListener("click", () => {
      state.expanded = !state.expanded;
      localStorage.setItem("contract-brs-expanded", String(state.expanded));
      render();
    });
    panel.querySelector(".brs-search").addEventListener("input", (event) => {
      state.filter = event.target.value.trim().toLowerCase();
      render();
    });
    panel.addEventListener("click", (event) => {
      const row = event.target.closest(".brs-team[data-team-id]");
      if (!row) return;
      navigateTo(`/teams/${encodeURIComponent(row.dataset.teamId)}`);
    });

    document.documentElement.appendChild(panel);
    return panel;
  }

  function render() {
    const panel = createPanel();
    panel.classList.toggle("is-collapsed", !state.expanded);

    const status = panel.querySelector(".brs-status");
    const list = panel.querySelector(".brs-list");
    const search = panel.querySelector(".brs-search");
    if (document.activeElement !== search) search.value = state.filter;

    if (!state.expanded) return;

    if (!token()) {
      status.textContent = "No token in localStorage. Open the site and log in again.";
      status.className = "brs-status is-error";
      list.innerHTML = "";
      return;
    }

    if (state.loading) {
      status.textContent = state.teams.length ? "Updating BRS..." : "Loading BRS...";
      status.className = "brs-status";
      if (!state.teams.length) {
        list.innerHTML = "";
        return;
      }
    }

    if (state.error) {
      status.textContent = state.error;
      status.className = "brs-status is-error";
      list.innerHTML = "";
      return;
    }

    const teams = state.teams.filter((team) => !state.filter || team.name.toLowerCase().includes(state.filter));
    status.className = "brs-status";
    status.textContent = state.lastUpdated
      ? `Updated ${state.lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
      : "";

    list.innerHTML = teams.map((team, index) => `
      <article class="brs-team ${team.isCurrentTeam ? "is-current" : ""}" data-team-id="${escapeHtml(team.id)}" title="${team.error || "Open team profile"}">
        <div class="brs-rank">${index + 1}</div>
        <div class="brs-main">
          <div class="brs-name-row">
            ${syndicateIcon(team)}
            <div class="brs-name">${escapeHtml(team.name)}</div>
          </div>
          <div class="brs-meta">
            <span>REP ${formatNumber(team.rep)}</span>
            ${team.credits !== null && team.credits !== undefined ? `<span>CR ${formatNumber(team.credits)}</span>` : ""}
            ${team.brsLevel !== null && team.brsLevel !== undefined ? `<span>lvl ${team.brsLevel}</span>` : ""}
            ${progressText(team) ? `<span>${progressText(team)}</span>` : ""}
            ${team.error ? `<span class="brs-bad">error</span>` : ""}
          </div>
        </div>
        <div class="brs-score" title="BRS score">
          ${brsIcon()}
          <span>${formatNumber(team.brsScore)}</span>
        </div>
      </article>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function refresh({ force = false } = {}) {
    const hasCache = loadCache();
    if (hasCache && !force) {
      state.error = "";
      state.loading = false;
      render();
      decorateLeaderboard();
      return;
    }

    state.loading = true;
    state.error = "";
    render();
    try {
      const [teams, users] = await Promise.all([loadTeams(), loadUsers()]);
      state.teams = teams;
      state.users = users;
      state.lastUpdated = new Date();
      saveCache();
      decorateLeaderboard();
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  function shouldAutoOpen() {
    if (localStorage.getItem("contract-brs-expanded") === "false") return false;
    const path = window.location.pathname;
    const query = new URLSearchParams(window.location.search);
    return path.includes("leaderboard")
      || query.get("tab") === "leaderboard"
      || path.includes("achievements")
      || path.includes("feed")
      || path.includes("potok")
      || path.includes("stream");
  }

  function closestLeaderboardRow(target) {
    const candidates = [
      target.closest("a"),
      target.closest("button"),
      target.closest("[role='row']"),
      target.closest("[role='listitem']"),
      target.closest("li"),
      target.closest("tr"),
      target.closest("article"),
      target.closest("div")
    ].filter(Boolean);
    return candidates.find((node) => !node.closest(`#${PANEL_ID}`) && node.textContent && node.textContent.trim().length > 0) || null;
  }

  function bestNameMatch(text, entries) {
    const normalized = text.toLowerCase();
    return entries
      .filter((entry) => entry.name && normalized.includes(entry.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0] || null;
  }

  function handleLeaderboardClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!shouldAutoOpen()) return;
    if (event.target.closest(`#${PANEL_ID}`)) return;

    const row = closestLeaderboardRow(event.target);
    if (!row) return;

    const text = row.textContent || "";
    const team = bestNameMatch(text, state.teams);
    const user = bestNameMatch(text, state.users);
    const match = team && user
      ? (team.name.length >= user.name.length ? { type: "team", entry: team } : { type: "user", entry: user })
      : team ? { type: "team", entry: team }
      : user ? { type: "user", entry: user }
      : null;
    if (!match) return;

    event.preventDefault();
    event.stopPropagation();
    navigateTo(match.type === "team" ? `/teams/${encodeURIComponent(match.entry.id)}` : `/users/${encodeURIComponent(match.entry.id)}`);
  }

  function decorateLeaderboard() {
    if (!shouldAutoOpen()) return;
    const entries = [...state.teams, ...state.users];
    if (!entries.length) return;
    document.querySelectorAll("article, li, tr, [role='row'], [role='listitem']").forEach((node) => {
      if (node.closest(`#${PANEL_ID}`)) return;
      if (bestNameMatch(node.textContent || "", entries)) {
        node.classList.add("contract-brs-clickable-profile");
        node.title = node.title || "Open profile";
      }
    });
  }

  function boot() {
    createPanel();
    state.expanded = shouldAutoOpen();
    loadCache();
    render();
    document.addEventListener("click", handleLeaderboardClick, true);
    const observer = new MutationObserver(() => decorateLeaderboard());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    refresh();
  }

  boot();
})();
