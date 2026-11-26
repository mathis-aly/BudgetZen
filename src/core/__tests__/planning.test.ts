import { describe, expect, it } from 'vitest';
import {
  detectResourceKind,
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  normalizeExternalUrl,
} from '../planning';

describe('Planning URL & YouTube helpers', () => {
  it('normalizes URLs cleanly', () => {
    expect(normalizeExternalUrl('  youtube.com/watch?v=dQw4w9WgXcQ  ')).toBe(
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(normalizeExternalUrl('https://lemonde.fr/economie')).toBe(
      'https://lemonde.fr/economie'
    );
    expect(normalizeExternalUrl('   ')).toBe('');
  });

  it('detects YOUTUBE vs ARTICLE automatically', () => {
    expect(detectResourceKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'YOUTUBE'
    );
    expect(detectResourceKind('https://youtu.be/dQw4w9WgXcQ')).toBe('YOUTUBE');
    expect(detectResourceKind('YOUTUBE.COM/shorts/AbCdEfGh123')).toBe('YOUTUBE');
    expect(detectResourceKind('https://blog.example.com/finance-personnelle')).toBe(
      'ARTICLE'
    );
  });

  it('extracts valid 11-character YouTube video IDs across formats', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')
    ).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/AbCdEfGh123?si=xyz')).toBe(
      'AbCdEfGh123'
    );
    expect(
      extractYouTubeVideoId('https://www.youtube.com/shorts/Z9yX8wV7uT6')
    ).toBe('Z9yX8wV7uT6');
    expect(
      extractYouTubeVideoId('https://www.youtube.com/embed/M7lc1UVf-VE')
    ).toBe('M7lc1UVf-VE');
    expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/@channel')).toBeNull();
  });

  it('builds thumbnail URL from video ID', () => {
    expect(getYouTubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
  });
});
