/**
 * Version and update checking routes
 * Checks GitHub releases for the public self-host repository
 */

const GITHUB_REPO = "HZMonama/regolab-self-host";
const CURRENT_VERSION = process.env.REGOLAB_VERSION || "2.0.1";

export const versionRoutes = async (fastify) => {
  // Get current version
  fastify.get(
    '/version',
    async (request, reply) => {
      reply.send({
        version: CURRENT_VERSION,
        buildTime: process.env.BUILD_TIME || null,
      });
    }
  );

  // Check for updates by querying GitHub releases
  fastify.get(
    '/version/check',
    async (request, reply) => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'RegoLab-Update-Checker',
            },
          }
        );

        if (!response.ok) {
          // No releases yet or repo not found
          if (response.status === 404) {
            return reply.send({
              current: CURRENT_VERSION,
              latest: null,
              updateAvailable: false,
              releaseUrl: null,
              message: "No releases found",
            });
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const release = await response.json();
        const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
        
        // Compare versions
        const updateAvailable = isNewerVersion(latestVersion, CURRENT_VERSION);

        reply.send({
          current: CURRENT_VERSION,
          latest: latestVersion,
          updateAvailable,
          releaseUrl: release.html_url,
          releaseName: release.name,
          releaseNotes: release.body,
          publishedAt: release.published_at,
        });
      } catch (error) {
        console.error("Failed to check for updates:", error);
        reply.code(500).send({
          success: false,
          error: "Failed to check for updates",
          current: CURRENT_VERSION,
        });
      }
    }
  );

  // List recent releases
  fastify.get(
    '/version/releases',
    async (request, reply) => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=5`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'RegoLab-Update-Checker',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return reply.send({ releases: [] });
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const releases = await response.json();
        
        reply.send({
          releases: releases.map(r => ({
            version: r.tag_name.replace(/^v/, ''),
            name: r.name,
            notes: r.body,
            url: r.html_url,
            publishedAt: r.published_at,
          })),
        });
      } catch (error) {
        console.error("Failed to fetch releases:", error);
        reply.code(500).send({
          success: false,
          error: "Failed to fetch releases",
        });
      }
    }
  );
};

/**
 * Compare two semantic versions
 * Returns true if version1 > version2
 */
function isNewerVersion(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    
    if (v1 > v2) return true;
    if (v1 < v2) return false;
  }
  
  return false;
}
