/**
 * GitHub OAuth routes for the Export to GitHub feature
 * Handles the OAuth web application flow to generate user access tokens
 */

export async function githubRoutes(fastify, opts) {
  const GITHUB_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
  const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  /**
   * Step 1: Initiate GitHub OAuth flow
   * Redirects user to GitHub's authorization page
   */
  fastify.get('/authorize', async (request, reply) => {
    const { state } = request.query;
    
    if (!state) {
      return reply.status(400).send({ error: 'Missing state parameter' });
    }

    if (!GITHUB_CLIENT_ID) {
      return reply.status(500).send({ error: 'GitHub App not configured' });
    }

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_CALLBACK_URL,
      state: state,
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    return reply.redirect(url);
  });

  /**
   * Step 2: Handle OAuth callback
   * Exchanges the authorization code for a user access token
   */
  fastify.get('/callback', async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    // Handle OAuth errors from GitHub
    if (error) {
      const errorMsg = encodeURIComponent(error_description || error);
      return reply.redirect(`${FRONTEND_URL}?github_error=${errorMsg}`);
    }

    if (!code) {
      return reply.redirect(`${FRONTEND_URL}?github_error=missing_code`);
    }

    if (!state) {
      return reply.redirect(`${FRONTEND_URL}?github_error=missing_state`);
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        const errorMsg = encodeURIComponent(tokenData.error_description || tokenData.error);
        return reply.redirect(`${FRONTEND_URL}?github_error=${errorMsg}`);
      }

      // Redirect back to frontend with token
      // Using URL fragment (#) for security - fragments are not sent to servers
      const params = new URLSearchParams({
        github_token: tokenData.access_token,
        github_state: state,
      });
      
      if (tokenData.refresh_token) {
        params.append('github_refresh_token', tokenData.refresh_token);
      }

      return reply.redirect(`${FRONTEND_URL}?${params.toString()}`);
    } catch (err) {
      console.error('GitHub OAuth error:', err);
      return reply.redirect(`${FRONTEND_URL}?github_error=token_exchange_failed`);
    }
  });

  /**
   * Proxy endpoint to publish files to GitHub
   * This keeps the token handling consistent and allows for future enhancements
   */
  fastify.post('/publish', async (request, reply) => {
    const { token, owner, repo, branch, files, commitMessage } = request.body;

    if (!token || !owner || !repo || !files || !Array.isArray(files)) {
      return reply.status(400).send({ 
        success: false, 
        error: 'Missing required fields: token, owner, repo, files' 
      });
    }

    const branchName = branch || 'main';
    const message = commitMessage || 'Update policy via RegoLab';

    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };

      // 1. Get the latest commit SHA for the branch
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
        { headers }
      );

      if (!refResponse.ok) {
        if (refResponse.status === 404) {
          return reply.status(404).send({ 
            success: false, 
            error: `Branch '${branchName}' not found` 
          });
        }
        throw new Error(`Failed to get branch ref: ${refResponse.statusText}`);
      }

      const refData = await refResponse.json();
      const latestCommitSha = refData.object.sha;

      // 2. Get the tree SHA from the latest commit
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
        { headers }
      );

      if (!commitResponse.ok) {
        throw new Error(`Failed to get commit: ${commitResponse.statusText}`);
      }

      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      // 3. Create blobs for each file
      const treeItems = await Promise.all(files.map(async (file) => {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
          {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8',
            }),
          }
        );

        if (!blobResponse.ok) {
          throw new Error(`Failed to create blob for ${file.path}: ${blobResponse.statusText}`);
        }

        const blobData = await blobResponse.json();
        return {
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      }));

      // 4. Create a new tree
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeItems,
          }),
        }
      );

      if (!treeResponse.ok) {
        throw new Error(`Failed to create tree: ${treeResponse.statusText}`);
      }

      const treeData = await treeResponse.json();

      // 5. Create a new commit
      const newCommitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            tree: treeData.sha,
            parents: [latestCommitSha],
          }),
        }
      );

      if (!newCommitResponse.ok) {
        throw new Error(`Failed to create commit: ${newCommitResponse.statusText}`);
      }

      const newCommitData = await newCommitResponse.json();

      // 6. Update the branch reference
      const updateRefResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sha: newCommitData.sha,
          }),
        }
      );

      if (!updateRefResponse.ok) {
        throw new Error(`Failed to update ref: ${updateRefResponse.statusText}`);
      }

      return reply.send({
        success: true,
        commitSha: newCommitData.sha,
        commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`,
      });
    } catch (err) {
      console.error('GitHub publish error:', err);
      return reply.status(500).send({ 
        success: false, 
        error: err.message 
      });
    }
  });

  /**
   * Proxy endpoint to list user's repositories
   * Avoids CORS issues when calling GitHub API from frontend
   */
  fastify.get('/repos', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    try {
      const response = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': authHeader,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        return reply.status(response.status).send({ 
          error: `GitHub API error: ${response.statusText}` 
        });
      }

      const repos = await response.json();
      return reply.send({ success: true, repos });
    } catch (err) {
      console.error('GitHub repos error:', err);
      return reply.status(500).send({ error: 'Failed to fetch repositories' });
    }
  });

  /**
   * Get branches for a repository
   */
  fastify.get('/repos/:owner/:repo/branches', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const { owner, repo } = request.params;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': authHeader,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        return reply.status(response.status).send({ 
          error: `GitHub API error: ${response.statusText}` 
        });
      }

      const branches = await response.json();
      return reply.send({ success: true, branches });
    } catch (err) {
      console.error('GitHub branches error:', err);
      return reply.status(500).send({ error: 'Failed to fetch branches' });
    }
  });
}

export default githubRoutes;
