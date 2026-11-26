'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import {
  type PlanningResourceKind,
  detectResourceKind,
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  normalizeExternalUrl,
} from '@/core';
import { Button, Modal } from '@/components/ui';

export function ResourceModal({
  open,
  onClose,
  onCreateResource,
}: {
  open: boolean;
  onClose: () => void;
  onCreateResource: (payload: {
    url: string;
    resourceKind: PlanningResourceKind;
    title: string;
    content: string | null;
  }) => Promise<void>;
}) {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrlInput('');
      setTitleInput('');
      setNotesInput('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const normalizedUrl = useMemo(() => normalizeExternalUrl(urlInput), [urlInput]);
  const detectedKind = useMemo(
    () => detectResourceKind(urlInput),
    [urlInput]
  );
  const youtubeId = useMemo(
    () =>
      detectedKind === 'YOUTUBE' && normalizedUrl
        ? extractYouTubeVideoId(normalizedUrl)
        : null,
    [detectedKind, normalizedUrl]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedUrl) {
      setError("Veuillez coller l'URL de l'article ou de la vidéo YouTube.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const cleanTitle =
        titleInput.trim() ||
        (detectedKind === 'YOUTUBE' ? 'Vidéo YouTube' : 'Article web');
      await onCreateResource({
        url: normalizedUrl,
        resourceKind: detectedKind,
        title: cleanTitle,
        content: notesInput.trim() ? notesInput.trim() : null,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’ajouter cette ressource.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter un article ou une vidéo YouTube"
      subtitle="Détection automatique YouTube & aperçu miniature"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="planning-resource-url"
              className="editorial-kicker block"
            >
              URL de la ressource
            </label>
            {urlInput.trim() && (
              <span
                className={
                  detectedKind === 'YOUTUBE'
                    ? 'font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 border border-[#B91C1C]/40 text-[#B91C1C] dark:border-[#EF4444]/40 dark:text-[#EF4444] rounded-[2px]'
                    : 'font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 border border-[#E2E0D8] dark:border-[#2A2A27] text-[#141413] dark:text-[#F2F0E8] rounded-[2px]'
                }
              >
                Détecté : {detectedKind}
              </span>
            )}
          </div>
          <input
            id="planning-resource-url"
            type="text"
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... ou https://..."
            className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-xs text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />
        </div>

        {youtubeId && (
          <div className="border border-[#E2E0D8] dark:border-[#2A2A27] rounded-sm overflow-hidden bg-[#111110]">
            <div className="relative">
              <img
                src={getYouTubeThumbnailUrl(youtubeId)}
                alt="Aperçu miniature YouTube"
                className="aspect-video w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 bg-[#111110]/85 border border-[#2A2A27] text-[#F7F6F2] font-mono text-[10px] tracking-wider rounded-[2px]">
                <Play className="h-3 w-3 fill-current" />
                YOUTUBE // {youtubeId}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="planning-resource-title"
            className="editorial-kicker block"
          >
            Titre (Serif)
          </label>
          <input
            id="planning-resource-title"
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder={
              detectedKind === 'YOUTUBE'
                ? 'Ex. Stratégie PEA MSCI World 2026'
                : 'Ex. Guide fiscalité dividendes'
            }
            className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-serif text-lg text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="planning-resource-notes"
            className="editorial-kicker block"
          >
            Notes ou synthèse (optionnel)
          </label>
          <textarea
            id="planning-resource-notes"
            rows={3}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Points clés à retenir, idées à relier…"
            className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] text-xs text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />
        </div>

        {error && (
          <p className="font-mono text-xs text-[#B91C1C] dark:text-[#EF4444]">
            {error}
          </p>
        )}

        <div className="pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27] flex items-center justify-between gap-3">
          {normalizedUrl ? (
            <a
              href={normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]"
            >
              <span>Tester le lien</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Ajout…' : 'Ajouter au canevas'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
