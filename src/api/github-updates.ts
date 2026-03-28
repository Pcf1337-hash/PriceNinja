import { APP_VERSION, GITHUB_REPO } from '@/src/utils/constants';

export interface GitHubRelease {
  version: string;
  tagName: string;
  releaseNotes: string;
  publishedAt: string;
  apkUrl: string;
  apkSize: number;
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }
  return 0;
}

export async function checkForUpdate(
  githubToken?: string
): Promise<GitHubRelease | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      headers.Authorization = `token ${githubToken}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers }
    );

    if (!response.ok) return null;

    const release = await response.json();
    const latestVersion = release.tag_name as string;

    if (compareVersions(latestVersion, APP_VERSION) <= 0) {
      return null; // Already up to date
    }

    const apkAsset = (release.assets as Array<Record<string, unknown>>)?.find(
      (a) => (a.name as string).endsWith('.apk')
    );

    if (!apkAsset) return null;

    return {
      version: latestVersion,
      tagName: release.tag_name as string,
      releaseNotes: release.body as string ?? '',
      publishedAt: release.published_at as string,
      apkUrl: apkAsset.browser_download_url as string,
      apkSize: apkAsset.size as number,
    };
  } catch {
    return null;
  }
}
