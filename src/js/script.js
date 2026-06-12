const GITHUB_USER = "jonnypaes";
const API_BASE = "https://api.github.com";
const MAX_REPOS = 24;
const DEFAULT_PAGE = window.location.protocol + '//' + window.location.hostname + window.location.pathname;

const FALLBACK_USER_URL = "./fallback/user.json";
const FALLBACK_REPOS_URL = "./fallback/repos.json";

const state = {
  user: null,
  repos: [],
  filteredRepos: []
};

const elements = {
  avatar: document.getElementById("avatar"),
  profileName: document.getElementById("profile-name"),
  profileHandle: document.getElementById("profile-handle"),
  profileBio: document.getElementById("profile-bio"),
  profileMeta: document.getElementById("profile-meta"),
  profileActions: document.getElementById("profile-actions"),
  repoCount: document.getElementById("repo-count"),
  followerCount: document.getElementById("follower-count"),
  languageCount: document.getElementById("language-count"),
  repoGrid: document.getElementById("repo-grid"),
  repoSearch: document.getElementById("repo-search")
};

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
	element.className = className;
  }

  if (textContent !== undefined && textContent !== null) {
	element.textContent = textContent;
  }

  return element;
}

function createLink(href, textContent, className) {
  const link = createElement("a", className, textContent);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function normalizeExternalUrl(value) {
  if (!value) return "";

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
	return trimmed;
  }

  return `https://${trimmed}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value || 0);
}

function formatDate(value) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en", {
	year: "numeric",
	month: "short",
	day: "2-digit"
  }).format(new Date(value));
}

async function fetchJson(url) {
  const response = await fetch(url, {
	headers: {
	  Accept: "application/vnd.github+json"
	}
  });

  if (!response.ok) {
	throw new Error(`GitHub request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchJsonWithFallback(primaryUrl, fallbackUrl, fallbackValue) {
  try {
    return await fetchJson(primaryUrl);
  } catch (primaryError) {
    console.warn("Primary request failed:", primaryUrl, primaryError);

    try {
      return await fetchJson(fallbackUrl);
    } catch (fallbackError) {
      console.warn("Fallback request failed:", fallbackUrl, fallbackError);

      if (fallbackValue !== undefined) {
        return fallbackValue;
      }

      throw primaryError;
    }
  }
}

function setStatus(message) {
  elements.repoGrid.replaceChildren(createElement("div", "status", message));
}

function renderProfile(user) {
  const displayName = user.name || user.login || "Jonny Paes";
  const blogUrl = normalizeExternalUrl(user.blog);

  elements.avatar.src = user.avatar_url;
  elements.profileName.textContent = displayName;
  elements.profileHandle.textContent = `@${user.login}`;
  elements.profileBio.textContent = user.bio || "Engineering profile focused on practical systems, tooling, web architecture, and deterministic workflows.";

  const metaItems = [
	["Location", user.location || "Not specified"],
	["Company", user.company || "Independent"],
	["GitHub since", formatDate(user.created_at)],
	["Last updated", formatDate(user.updated_at)]
  ];

  elements.profileMeta.replaceChildren(
	...metaItems.map(([label, value]) => {
	  const item = createElement("li", "meta-item");
	  item.append(
		createElement("span", "meta-label", label),
		createElement("span", "meta-value", value)
	  );
	  return item;
	})
  );

  const actions = [createLink(user.html_url, "GitHub", "button primary")];

  if (blogUrl) {
	actions.push(createLink(blogUrl, "Website", "button"));
  }

  elements.profileActions.replaceChildren(...actions);
  elements.repoCount.textContent = formatNumber(user.public_repos);
  elements.followerCount.textContent = formatNumber(user.followers);
}

function normalizeComparableUrl(value) {
  return normalizeExternalUrl(value).replace(/\/$/, '');
}

function shouldShowRepo(repo) {
  const isFork = repo.fork;
  const isProfileReadmeRepo = repo.name.toLowerCase() === GITHUB_USER.toLowerCase();
  const isCurrentPage = normalizeComparableUrl(repo.homepage) === normalizeComparableUrl(DEFAULT_PAGE);

  return !isFork && !isProfileReadmeRepo && !isCurrentPage;
}

function rankRepos(repos) {
  return repos
	.filter(shouldShowRepo)
	.sort((a, b) => {
	  const scoreA = (a.stargazers_count * 3) + a.forks_count + (Date.parse(a.pushed_at) / 1000000000000);
	  const scoreB = (b.stargazers_count * 3) + b.forks_count + (Date.parse(b.pushed_at) / 1000000000000);
	  return scoreB - scoreA;
	})
	.slice(0, MAX_REPOS);
}

function getLanguageCount(repos) {
  const languages = new Set();

  repos.forEach(repo => {
	if (repo.language) {
	  languages.add(repo.language);
	}
  });

  return languages.size;
}

function renderRepos(repos) {
  if (!repos.length) {
	setStatus("No repositories matched your search.");
	return;
  }

  const cards = repos.map(repo => {
	const card = createElement("article", "repo-card");
	const header = createElement("div", "repo-header");
	const title = createElement("h3", "repo-title");
	const titleLink = createLink(repo.html_url, repo.name, "");
	const visibility = createElement("span", "repo-visibility", repo.visibility || "public");
	const description = createElement("p", "repo-description", repo.description || "No repository description provided.");
	const footer = createElement("div", "repo-footer");
	const meta = createElement("div", "repo-meta");
	const links = createElement("div", "repo-links");

	title.append(titleLink);
	header.append(title, visibility);

	if (repo.language) {
	  meta.append(createElement("span", "language-dot", repo.language));
	}

	meta.append(
	  createElement("span", "", `★ ${formatNumber(repo.stargazers_count)}`),
	  createElement("span", "", `Forks ${formatNumber(repo.forks_count)}`),
	  createElement("span", "", `Updated ${formatDate(repo.pushed_at)}`)
	);

	links.append(createLink(repo.html_url, "Code", ""));

	if (repo.homepage) {
	  links.append(createLink(normalizeExternalUrl(repo.homepage), "Live", ""));
	}

	footer.append(meta, links);
	card.append(header, description, footer);
	return card;
  });

  elements.repoGrid.replaceChildren(...cards);
}

function filterRepos(query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
	state.filteredRepos = state.repos;
	renderRepos(state.filteredRepos);
	return;
  }

  state.filteredRepos = state.repos.filter(repo => {
	const searchable = [
	  repo.name,
	  repo.description,
	  repo.language,
	  repo.topics ? repo.topics.join(" ") : ""
	].join(" ").toLowerCase();

	return searchable.includes(normalizedQuery);
  });

  renderRepos(state.filteredRepos);
}

async function init() {
  try {
    const [user, repos] = await Promise.all([
      fetchJsonWithFallback(
        `${API_BASE}/users/${GITHUB_USER}`,
        FALLBACK_USER_URL
      ),
      fetchJsonWithFallback(
        `${API_BASE}/users/${GITHUB_USER}/repos?sort=updated&per_page=100`,
        FALLBACK_REPOS_URL,
        []
      )
    ]);

    state.user = user;
    state.repos = rankRepos(repos);
    state.filteredRepos = state.repos;

    renderProfile(user);
    elements.languageCount.textContent = formatNumber(getLanguageCount(state.repos));
    renderRepos(state.filteredRepos);
  } catch (error) {
    console.error(error);
    setStatus("Could not load GitHub data or local fallback files.");
  }
}

if (elements.repoSearch) {
  elements.repoSearch.addEventListener("input", event => {
    filterRepos(event.target.value);
  });
}

init();
