function createGitHubApiAdapter({ owner, repo, token, fetch = globalThis.fetch, baseBranch = "main", timeoutMs = 30000 }) {
  if (!token) {
    throw new Error("GitDocs Sync needs a GitHub token. Pass github_token: ${{ secrets.GITHUB_TOKEN }} in your workflow.");
  }
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  async function request(path, options = {}) {
    const requestOptions = {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    };
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl}${path}`, { ...requestOptions, signal: controller.signal });
        if (response.ok) {
          return response.json();
        }
        const body = await response.text();
        const error = new Error(formatGitHubError({ method: options.method || "GET", path, status: response.status, body }));
        error.status = response.status;
        error.body = body;
        if (!isTransientStatus(response.status) || attempt === 3) {
          throw error;
        }
        lastError = error;
      } catch (error) {
        lastError = error;
        if (!isTransientStatus(error.status) || attempt === 3) {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
      await delay(50 * attempt);
    }
    throw lastError;
  }

  return {
    async upsertIssue({ title, body }) {
      const issues = await requestAllPages("/issues?state=open&labels=gitdocs-sync");
      const existing = issues.find((issue) => issue.title === title);
      const payload = { title, body, labels: ["gitdocs-sync"] };
      const issue = existing
        ? await request(`/issues/${existing.number}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await request("/issues", { method: "POST", body: JSON.stringify(payload) });
      return { number: issue.number, url: issue.html_url };
    },
    async getUserPermission(username) {
      const result = await request(`/collaborators/${username}/permission`);
      return result.permission;
    },
    async replyToIssue(issueNumber, body) {
      const comment = await request(`/issues/${issueNumber}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      return { id: comment.id, url: comment.html_url };
    },
    async addIssueLabels(issueNumber, labels) {
      return request(`/issues/${issueNumber}/labels`, {
        method: "POST",
        body: JSON.stringify({ labels }),
      });
    },
    async createPullRequest({ branch, title, body, files, labels = [] }) {
      const baseRef = await request(`/git/ref/heads/${baseBranch}`);
      const workingBranch = await ensureBranchFromBase({ branch, sha: baseRef.object.sha });
      for (const [filePath, content] of Object.entries(files)) {
        if (content === null) {
          await deleteContent({ branch: workingBranch, title, filePath });
        } else {
          await putContent({ branch: workingBranch, title, filePath, content });
        }
      }
      const pullRequest = await createOrUpdatePullRequest({ branch: workingBranch, title, body });
      if (labels.length > 0) {
        await request(`/issues/${pullRequest.number}/labels`, {
          method: "POST",
          body: JSON.stringify({ labels }),
        });
      }
      return { number: pullRequest.number, url: pullRequest.html_url, reused: Boolean(pullRequest.reused) };
    },
    async commitFiles({ title, files }) {
      for (const [filePath, content] of Object.entries(files)) {
        await putContent({ branch: baseBranch, title, filePath, content });
      }
      return { status: "committed" };
    },
  };

  async function ensureBranchFromBase({ branch, sha }) {
    try {
      await request("/git/refs", {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha,
        }),
      });
      return branch;
    } catch (error) {
      if (String(error.message).includes("422") && String(error.message).includes("Reference already exists")) {
        const openPullRequests = await openPullRequestsForBranch(branch);
        if (openPullRequests.length > 0) {
          return branch;
        }
        return createFreshBranchFromBase({ branch, sha });
      }
      throw error;
    }
  }

  async function createFreshBranchFromBase({ branch, sha }) {
    const uniqueBranch = `${branch}-${sha.slice(0, 7)}`;
    try {
      await request("/git/refs", {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${uniqueBranch}`,
          sha,
        }),
      });
    } catch (error) {
      if (!(String(error.message).includes("422") && String(error.message).includes("Reference already exists"))) {
        throw error;
      }
      const openPullRequests = await openPullRequestsForBranch(uniqueBranch);
      if (openPullRequests.length === 0) {
        throw error;
      }
    }
    return uniqueBranch;
  }

  async function requestAllPages(path) {
    const all = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const items = await request(`${path}${separator}per_page=100&page=${page}`);
      all.push(...items);
      if (!Array.isArray(items) || items.length < 100) {
        return all;
      }
    }
  }

  async function openPullRequestsForBranch(branch) {
    return request(`/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
  }

  async function createOrUpdatePullRequest({ branch, title, body }) {
    try {
      return await request("/pulls", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          head: branch,
          base: baseBranch,
        }),
      });
    } catch (error) {
      if (!isDuplicatePullRequestError(error)) {
        throw error;
      }
      const [existing] = await openPullRequestsForBranch(branch);
      if (!existing) {
        throw error;
      }
      const updated = await request(`/pulls/${existing.number}`, {
        method: "PATCH",
        body: JSON.stringify({ title, body }),
      });
      await request(`/issues/${existing.number}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: "GitDocs Sync updated this PR because a sync PR for this language branch was already open.",
        }),
      });
      return { ...updated, reused: true };
    }
  }

  async function putContent({ branch, title, filePath, content, sha }) {
    try {
      return await request(`/contents/${encodeURIComponent(filePath)}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `${title}: ${filePath}`,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          ...(sha ? { sha } : {}),
        }),
      });
    } catch (error) {
      if (!(error.status === 422 && String(error.body).includes("sha"))) {
        throw error;
      }
      if (sha) {
        throw error;
      }
      const existing = await request(`/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`);
      return putContent({ branch, title, filePath, content, sha: existing.sha });
    }
  }

  async function deleteContent({ branch, title, filePath }) {
    const existing = await request(`/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`);
    return request(`/contents/${encodeURIComponent(filePath)}`, {
      method: "DELETE",
      body: JSON.stringify({
        message: `${title}: ${filePath}`,
        sha: existing.sha,
        branch,
      }),
    });
  }

  function isDuplicatePullRequestError(error) {
    return error.status === 422 && String(error.body).includes("pull request") && String(error.body).includes("already exists");
  }
}

function formatGitHubError({ method, path, status, body }) {
  const safeBody = redactSecrets(body);
  if (status === 401 || status === 403) {
    return `GitDocs Sync could not access this repository. Check that github_token is configured and has contents: write, pull-requests: write, and issues: write permissions. GitHub returned ${status} for ${method} ${path}: ${safeBody}`;
  }
  if (status === 422 && body.includes("Reference already exists")) {
    return `GitDocs Sync found an existing sync branch. It will try to reuse it. GitHub returned ${status} for ${method} ${path}: ${safeBody}`;
  }
  if (status === 422 && body.includes("pull request")) {
    return `GitDocs Sync could not open a new PR because GitHub reported a PR/branch validation issue. GitHub returned ${status} for ${method} ${path}: ${safeBody}`;
  }
  return `GitDocs Sync GitHub request failed. GitHub returned ${status} for ${method} ${path}: ${safeBody}`;
}

function redactSecrets(text) {
  return String(text)
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED]")
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function isTransientStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createGitHubApiAdapter };
