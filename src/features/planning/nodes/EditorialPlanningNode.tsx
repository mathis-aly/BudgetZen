'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ExternalLink, Play, Trash2 } from 'lucide-react';
import {
  type PlanningNodeType,
  type PlanningResourceKind,
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  normalizeExternalUrl,
} from '@/core';
import { cn } from '@/lib/cn';

export type EditorialNodeData = Record<string, unknown> & {
  nodeType: PlanningNodeType;
  title: string;
  content: string | null;
  url: string | null;
  resourceKind: PlanningResourceKind | null;
  onUpdateNode: (
    id: string,
    patch: Partial<{
      type: PlanningNodeType;
      title: string;
      content: string | null;
    }>
  ) => void;
  onDeleteNode: (id: string) => void;
};

export type EditorialFlowNode = Node<EditorialNodeData, 'editorial'>;

const HANDLE_CLASS =
  '!h-2.5 !w-2.5 !rounded-full !border !border-[#F7F6F2] dark:!border-[#111110] !bg-[#141413] dark:!bg-[#F2F0E8] hover:!bg-[#B45309] dark:hover:!bg-[#F59E0B] transition-colors';

function EditorialPlanningNodeInner({
  id,
  data,
  selected,
}: NodeProps<EditorialFlowNode>) {
  const [titleDraft, setTitleDraft] = useState(data.title);
  const [contentDraft, setContentDraft] = useState(data.content ?? '');
  const [imgFailed, setImgFailed] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const lastSavedRef = useRef({
    title: data.title,
    content: data.content ?? '',
  });

  useEffect(() => {
    setTitleDraft(data.title);
    setContentDraft(data.content ?? '');
    lastSavedRef.current = {
      title: data.title,
      content: data.content ?? '',
    };
  }, [data.title, data.content]);

  useEffect(() => {
    setImgFailed(false);
  }, [data.url]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const commitDraft = (nextTitle: string, nextContent: string) => {
    const cleanTitle = nextTitle.trim() || 'Sans titre';
    const cleanContent = nextContent.trim() ? nextContent.trim() : null;
    const prevSavedContent = lastSavedRef.current.content.trim() || null;

    if (
      cleanTitle === lastSavedRef.current.title &&
      cleanContent === prevSavedContent
    ) {
      return;
    }

    lastSavedRef.current = {
      title: cleanTitle,
      content: cleanContent ?? '',
    };
    data.onUpdateNode(id, {
      title: cleanTitle,
      content: cleanContent,
    });
  };

  const scheduleCommit = (nextTitle: string, nextContent: string) => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      commitDraft(nextTitle, nextContent);
      debounceRef.current = null;
    }, 500);
  };

  const handleToggleIdeaGoal = () => {
    if (data.nodeType === 'RESOURCE') return;
    const nextType: PlanningNodeType =
      data.nodeType === 'GOAL' ? 'IDEA' : 'GOAL';
    data.onUpdateNode(id, { type: nextType });
  };

  const normalizedUrl = data.url ? normalizeExternalUrl(data.url) : '';
  const youtubeId =
    data.nodeType === 'RESOURCE' &&
    data.resourceKind === 'YOUTUBE' &&
    normalizedUrl
      ? extractYouTubeVideoId(normalizedUrl)
      : null;

  const isGoal = data.nodeType === 'GOAL';
  const isResource = data.nodeType === 'RESOURCE';
  const isYoutube = isResource && data.resourceKind === 'YOUTUBE';

  return (
    <div
      className={cn(
        'w-72 rounded-sm bg-[#FFFFFF] dark:bg-[#181816] text-[#141413] dark:text-[#F2F0E8] border transition-colors',
        selected
          ? 'border-[#B45309] dark:border-[#F59E0B]'
          : 'border-[#E2E0D8] dark:border-[#2A2A27]',
        isGoal && 'border-t-2 border-t-[#15803D] dark:border-t-[#22C55E]'
      )}
    >
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={HANDLE_CLASS}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={HANDLE_CLASS}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={HANDLE_CLASS}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={HANDLE_CLASS}
      />

      {/* Hairline Masthead Header */}
      <div className="px-3 py-2 border-b border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] flex items-center justify-between gap-2">
        {isResource ? (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'font-mono text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 border rounded-[2px]',
                isYoutube
                  ? 'border-[#B91C1C]/40 text-[#B91C1C] dark:border-[#EF4444]/40 dark:text-[#EF4444] bg-[#B91C1C]/[0.06]'
                  : 'border-[#E2E0D8] dark:border-[#2A2A27] text-[#141413] dark:text-[#F2F0E8] bg-[#F7F6F2] dark:bg-[#111110]'
              )}
            >
              {isYoutube ? 'YOUTUBE' : 'ARTICLE'}
            </span>
            {normalizedUrl && (
              <a
                href={normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvrir le lien dans un nouvel onglet"
                className="nodrag inline-flex items-center gap-1 font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] truncate"
              >
                <span className="truncate">Ouvrir</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleToggleIdeaGoal}
            title="Cliquer pour basculer Idée / Objectif"
            className={cn(
              'nodrag font-mono text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 border rounded-[2px] transition-colors',
              isGoal
                ? 'border-[#15803D]/40 text-[#15803D] dark:border-[#22C55E]/40 dark:text-[#22C55E] bg-[#15803D]/[0.06]'
                : 'border-[#E2E0D8] dark:border-[#2A2A27] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]'
            )}
          >
            {isGoal ? 'OBJECTIF' : 'IDÉE'}
          </button>
        )}

        <button
          type="button"
          onClick={() => data.onDeleteNode(id)}
          aria-label="Supprimer cette carte"
          title="Supprimer cette carte"
          className="nodrag p-1 text-[#5C5B57] dark:text-[#9A9890] hover:text-[#B91C1C] dark:hover:text-[#EF4444] transition-colors rounded-[2px]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2.5">
        {isYoutube && normalizedUrl && (
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nodrag group block relative border border-[#E2E0D8] dark:border-[#2A2A27] rounded-sm overflow-hidden bg-[#111110]"
          >
            {youtubeId && !imgFailed ? (
              <img
                src={getYouTubeThumbnailUrl(youtubeId)}
                alt={titleDraft}
                loading="lazy"
                onError={() => setImgFailed(true)}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center gap-1.5 text-[#F7F6F2]">
                <Play className="h-5 w-5" />
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#9A9890]">
                  YOUTUBE{youtubeId ? ` // ${youtubeId}` : ''}
                </span>
              </div>
            )}
            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#111110]/85 border border-[#2A2A27] text-[#F7F6F2] font-mono text-[9px] uppercase tracking-wider rounded-[2px]">
              <Play className="h-2.5 w-2.5 fill-current" />
              Vidéo
            </span>
          </a>
        )}

        <input
          type="text"
          value={titleDraft}
          onChange={(e) => {
            const val = e.target.value;
            setTitleDraft(val);
            scheduleCommit(val, contentDraft);
          }}
          onBlur={() => {
            if (debounceRef.current !== null) {
              window.clearTimeout(debounceRef.current);
              debounceRef.current = null;
            }
            commitDraft(titleDraft, contentDraft);
          }}
          placeholder="Titre de la carte…"
          aria-label="Titre de la carte"
          className="nodrag nowheel w-full bg-transparent font-serif text-lg leading-snug text-[#141413] dark:text-[#F2F0E8] placeholder:text-[#9A9890] focus:outline-none border-b border-transparent focus:border-[#E2E0D8] dark:focus:border-[#2A2A27] pb-0.5"
        />

        <textarea
          rows={3}
          value={contentDraft}
          onChange={(e) => {
            const val = e.target.value;
            setContentDraft(val);
            scheduleCommit(titleDraft, val);
          }}
          onBlur={() => {
            if (debounceRef.current !== null) {
              window.clearTimeout(debounceRef.current);
              debounceRef.current = null;
            }
            commitDraft(titleDraft, contentDraft);
          }}
          placeholder="Notes, montant estimé ou point clé…"
          aria-label="Notes de la carte"
          className="nodrag nowheel w-full resize-none bg-transparent font-sans text-xs leading-relaxed text-[#5C5B57] dark:text-[#9A9890] placeholder:text-[#9A9890]/70 focus:outline-none"
        />

        {isResource && !isYoutube && normalizedUrl && (
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nodrag block pt-1.5 border-t border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] truncate"
          >
            {normalizedUrl}
          </a>
        )}
      </div>
    </div>
  );
}

export const EditorialPlanningNode = memo(EditorialPlanningNodeInner);
