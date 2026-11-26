import type { PlanningResourceKind } from './types';

/**
 * Normalizes a pasted external URL by trimming whitespace and prepending `https://`
 * when no explicit `http://` or `https://` scheme is provided.
 */
export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Classifies a URL as YOUTUBE whenever its host/path references `youtube.com`
 * or `youtu.be` (case-insensitive), falling back to ARTICLE otherwise.
 */
export function detectResourceKind(rawUrl: string): PlanningResourceKind {
  const lower = rawUrl.trim().toLowerCase();
  if (!lower) return 'ARTICLE';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'YOUTUBE';
  }
  return 'ARTICLE';
}

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts a validated 11-character YouTube video ID from common share/watch/
 * shorts/embed/live URLs, returning `null` if none is found.
 */
export function extractYouTubeVideoId(rawUrl: string): string | null {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    candidate = seg ?? null;
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const vParam = parsed.searchParams.get('v');
    if (vParam) {
      candidate = vParam;
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex((p) =>
        ['shorts', 'embed', 'live', 'v'].includes(p)
      );
      if (markerIdx >= 0 && parts[markerIdx + 1]) {
        candidate = parts[markerIdx + 1];
      }
    }
  }

  return candidate && YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
}

/**
 * Returns the standard YouTube thumbnail URL for a valid video ID.
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
