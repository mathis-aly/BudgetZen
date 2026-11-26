'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type OnNodeDrag,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Lightbulb, Link2, LogOut, Trash2, X } from 'lucide-react';
import type {
  PlanningEdgeDTO,
  PlanningNodeDTO,
  PlanningNodeType,
  PlanningResourceKind,
} from '@/core';
import { useTheme } from '@/components/ui';
import { useSandbox } from '@/features/dev-console';
import {
  type EditorialFlowNode,
  EditorialPlanningNode,
} from './nodes/EditorialPlanningNode';
import { ResourceModal } from './ResourceModal';

const NODE_TYPES = {
  editorial: EditorialPlanningNode,
};

const QUICK_EDGE_LABELS = ['finance', 'dépend de', 'inspiration'];

function dtoToFlowEdge(edge: PlanningEdgeDTO, isDark: boolean): Edge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'smoothstep',
    label: edge.label ?? undefined,
    style: {
      strokeWidth: 1.5,
      stroke: isDark ? '#9A9890' : '#141413',
    },
    labelStyle: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fill: isDark ? '#F2F0E8' : '#141413',
    },
    labelBgStyle: {
      fill: isDark ? '#181816' : '#FFFFFF',
      stroke: isDark ? '#2A2A27' : '#E2E0D8',
      strokeWidth: 1,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 2,
  };
}

export function PlanningWorkspace() {
  const { isPlanningOpen, isSandbox, exitPlanning } = useSandbox();

  if (!isPlanningOpen) return null;

  return (
    <div
      className={
        isSandbox
          ? 'fixed inset-x-0 bottom-0 top-7 z-[48] bg-[#F7F6F2] dark:bg-[#111110]'
          : 'fixed inset-0 z-[48] bg-[#F7F6F2] dark:bg-[#111110]'
      }
      role="region"
      aria-label="Canevas de planification BudgetZen"
    >
      <ReactFlowProvider>
        <PlanningCanvasInner exitPlanning={exitPlanning} isSandbox={isSandbox} />
      </ReactFlowProvider>
    </div>
  );
}

function PlanningCanvasInner({
  exitPlanning,
  isSandbox,
}: {
  exitPlanning: () => void;
  isSandbox: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<EditorialFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const cascadeRef = useRef(0);

  const updateNodeImpl = useCallback(
    async (
      id: string,
      patch: Partial<{
        type: PlanningNodeType;
        title: string;
        content: string | null;
      }>
    ) => {
      setNodes((curr) =>
        curr.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...(patch.type !== undefined ? { nodeType: patch.type } : {}),
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.content !== undefined
                    ? { content: patch.content }
                    : {}),
                },
              }
            : n
        )
      );

      try {
        const res = await fetch(`/api/planning/nodes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('Échec de sauvegarde de la carte.');
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Erreur de sauvegarde.'
        );
      }
    },
    [setNodes]
  );

  const deleteNodeImpl = useCallback(
    async (id: string) => {
      setNodes((curr) => curr.filter((n) => n.id !== id));
      setEdges((curr) =>
        curr.filter((e) => e.source !== id && e.target !== id)
      );

      try {
        const res = await fetch(`/api/planning/nodes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Impossible de supprimer cette carte.');
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Erreur de suppression.'
        );
      }
    },
    [setEdges, setNodes]
  );

  const updateNodeRef = useRef(updateNodeImpl);
  const deleteNodeRef = useRef(deleteNodeImpl);
  updateNodeRef.current = updateNodeImpl;
  deleteNodeRef.current = deleteNodeImpl;

  const stableUpdateNode = useCallback(
    (
      id: string,
      patch: Partial<{
        type: PlanningNodeType;
        title: string;
        content: string | null;
      }>
    ) => {
      void updateNodeRef.current(id, patch);
    },
    []
  );

  const stableDeleteNode = useCallback((id: string) => {
    void deleteNodeRef.current(id);
  }, []);

  const dtoToFlowNode = useCallback(
    (dto: PlanningNodeDTO): EditorialFlowNode => ({
      id: dto.id,
      type: 'editorial',
      position: { x: dto.positionX, y: dto.positionY },
      data: {
        nodeType: dto.type,
        title: dto.title,
        content: dto.content,
        url: dto.url,
        resourceKind: dto.resourceKind,
        onUpdateNode: stableUpdateNode,
        onDeleteNode: stableDeleteNode,
      },
    }),
    [stableDeleteNode, stableUpdateNode]
  );

  // Load initial graph from SQLite (or Sandbox memory when in Sandbox Mode)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorBanner(null);

    fetch('/api/planning', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Impossible de charger la planification.');
        return res.json() as Promise<{
          nodes: PlanningNodeDTO[];
          edges: PlanningEdgeDTO[];
        }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setNodes((payload.nodes ?? []).map(dtoToFlowNode));
        setEdges((payload.edges ?? []).map((e) => dtoToFlowEdge(e, isDark)));
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorBanner(
          err instanceof Error ? err.message : 'Erreur de chargement.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dtoToFlowNode, isDark, isSandbox, setEdges, setNodes]);

  // Keep existing edge strokes/labels synced cleanly with light/dark theme toggle
  useEffect(() => {
    setEdges((curr) =>
      curr.map((e) => ({
        ...e,
        style: {
          ...e.style,
          strokeWidth: 1.5,
          stroke: isDark ? '#9A9890' : '#141413',
        },
        labelStyle: {
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fill: isDark ? '#F2F0E8' : '#141413',
        },
        labelBgStyle: {
          fill: isDark ? '#181816' : '#FFFFFF',
          stroke: isDark ? '#2A2A27' : '#E2E0D8',
          strokeWidth: 1,
        },
      }))
    );
  }, [isDark, setEdges]);

  const computeCenterPosition = useCallback(() => {
    cascadeRef.current = (cascadeRef.current + 1) % 6;
    const offset = cascadeRef.current * 28;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const pos = screenToFlowPosition({
      x: vw / 2 - 140 + offset,
      y: vh / 2 - 90 + offset,
    });
    return {
      x: Math.round(pos.x),
      y: Math.round(pos.y),
    };
  }, [screenToFlowPosition]);

  const handleCreateIdea = async () => {
    setErrorBanner(null);
    const pos = computeCenterPosition();
    try {
      const res = await fetch('/api/planning/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'IDEA',
          title: 'Nouvelle idée',
          content: '',
          positionX: pos.x,
          positionY: pos.y,
        }),
      });
      if (!res.ok) throw new Error("Impossible d'ajouter une idée.");
      const created: PlanningNodeDTO = await res.json();
      setNodes((curr) => [...curr, dtoToFlowNode(created)]);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Impossible d'ajouter une idée."
      );
    }
  };

  const handleCreateResource = async (payload: {
    url: string;
    resourceKind: PlanningResourceKind;
    title: string;
    content: string | null;
  }) => {
    setErrorBanner(null);
    const pos = computeCenterPosition();
    const res = await fetch('/api/planning/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'RESOURCE',
        title: payload.title,
        content: payload.content,
        url: payload.url,
        resourceKind: payload.resourceKind,
        positionX: pos.x,
        positionY: pos.y,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Impossible d'ajouter cette ressource.");
    }
    const created: PlanningNodeDTO = await res.json();
    setNodes((curr) => [...curr, dtoToFlowNode(created)]);
  };

  const handleNodeDragStop: OnNodeDrag<EditorialFlowNode> = useCallback(
    async (_event, node) => {
      try {
        await fetch(`/api/planning/nodes/${encodeURIComponent(node.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionX: Math.round(node.position.x * 10) / 10,
            positionY: Math.round(node.position.y * 10) / 10,
          }),
        });
      } catch {
        // Silent background save fallback
      }
    },
    []
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const duplicate = edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (duplicate) return;

      const tempId = `tmp_${Date.now()}`;
      const optimisticEdge: Edge = {
        id: tempId,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'smoothstep',
        style: {
          strokeWidth: 1.5,
          stroke: isDark ? '#9A9890' : '#141413',
        },
      };
      setEdges((curr) => [...curr, optimisticEdge]);

      try {
        const res = await fetch('/api/planning/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: connection.source,
            targetId: connection.target,
          }),
        });
        if (!res.ok) throw new Error('Échec de création de la connexion.');
        const saved: PlanningEdgeDTO = await res.json();
        setEdges((curr) =>
          curr.map((e) =>
            e.id === tempId
              ? {
                  ...e,
                  id: saved.id,
                  label: saved.label ?? undefined,
                }
              : e
          )
        );
        setSelectedEdgeId(saved.id);
        setEdgeLabelDraft(saved.label ?? '');
      } catch (err) {
        setEdges((curr) => curr.filter((e) => e.id !== tempId));
        setErrorBanner(
          err instanceof Error ? err.message : 'Impossible de créer le lien.'
        );
      }
    },
    [edges, isDark, setEdges]
  );

  const handleEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const edge of deleted) {
      if (edge.id.startsWith('tmp_')) continue;
      await fetch(`/api/planning/edges/${encodeURIComponent(edge.id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    setSelectedEdgeId(null);
  }, []);

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const saveEdgeLabel = async (labelValue: string) => {
    if (!selectedEdge) return;
    const clean = labelValue.trim() ? labelValue.trim() : null;
    setEdges((curr) =>
      curr.map((e) =>
        e.id === selectedEdge.id ? { ...e, label: clean ?? undefined } : e
      )
    );
    await fetch(
      `/api/planning/edges/${encodeURIComponent(selectedEdge.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: clean }),
      }
    ).catch(() => {});
  };

  const deleteSelectedEdge = async () => {
    if (!selectedEdge) return;
    const targetId = selectedEdge.id;
    setEdges((curr) => curr.filter((e) => e.id !== targetId));
    setSelectedEdgeId(null);
    if (!targetId.startsWith('tmp_')) {
      await fetch(`/api/planning/edges/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Top-Left Editorial Canvas Masthead */}
      <div className="fixed top-4 left-4 z-20 pointer-events-none flex items-center gap-3 px-3 py-1.5 bg-[#FFFFFF]/95 dark:bg-[#181816]/95 border border-[#E2E0D8] dark:border-[#2A2A27] rounded-sm">
        <span className="font-serif text-base text-[#141413] dark:text-[#F2F0E8] leading-none">
          Planification
        </span>
        <span className="h-3.5 w-px bg-[#E2E0D8] dark:bg-[#2A2A27]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
          {nodes.length} carte{nodes.length > 1 ? 's' : ''} · {edges.length} lien
          {edges.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Selected Edge Label Inspector */}
      {selectedEdge && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)] bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] rounded-sm px-3 py-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#5C5B57] dark:text-[#9A9890]">
            Connexion
          </span>
          <input
            type="text"
            value={edgeLabelDraft}
            onChange={(e) => setEdgeLabelDraft(e.target.value)}
            onBlur={() => void saveEdgeLabel(edgeLabelDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveEdgeLabel(edgeLabelDraft);
              }
            }}
            placeholder="Libellé (ex. finance)"
            className="w-36 px-2 py-0.5 bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] rounded-[2px] text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413]"
          />
          <div className="hidden sm:flex items-center gap-1">
            {QUICK_EDGE_LABELS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setEdgeLabelDraft(chip);
                  void saveEdgeLabel(chip);
                }}
                className="px-1.5 py-0.5 border border-[#E2E0D8] dark:border-[#2A2A27] text-[10px] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] rounded-[2px]"
              >
                {chip}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void deleteSelectedEdge()}
            title="Supprimer ce lien"
            className="p-1 text-[#B91C1C] dark:text-[#EF4444] hover:bg-[#B91C1C]/10 rounded-[2px]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedEdgeId(null)}
            aria-label="Fermer l’inspecteur de lien"
            className="p-1 text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Non-blocking Error Strip */}
      {errorBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-[#B91C1C] text-[#F7F6F2] font-mono text-[11px] rounded-sm flex items-center gap-2">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            aria-label="Fermer l’erreur"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Empty Canvas Prompt */}
      {!loading && nodes.length === 0 && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none px-4">
          <div className="max-w-sm text-center border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF]/90 dark:bg-[#181816]/90 px-6 py-5 rounded-sm">
            <p className="editorial-kicker">Canevas vierge · ML</p>
            <h2 className="font-serif text-2xl text-[#141413] dark:text-[#F2F0E8] mt-1.5">
              Organisez vos idées &amp; projets
            </h2>
            <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-2 leading-relaxed">
              Créez une carte avec <strong>+ Nouvelle Idée</strong>, ajoutez une
              vidéo YouTube ou un article, puis tirez un fil entre deux points
              pour relier vos projets.
            </p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onEdgeClick={(_event, edge) => {
          setSelectedEdgeId(edge.id);
          setEdgeLabelDraft(
            typeof edge.label === 'string' ? edge.label : ''
          );
        }}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={() => setSelectedEdgeId(null)}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: {
            strokeWidth: 1.5,
            stroke: isDark ? '#9A9890' : '#141413',
          },
        }}
        fitView={nodes.length > 0}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.3}
          color={isDark ? '#2A2A27' : '#CBC8BE'}
        />
        <Controls showInteractive={false} />
        <MiniMap
          className="hidden sm:block"
          pannable
          zoomable
          nodeColor={() => (isDark ? '#2A2A27' : '#D5D2C8')}
          maskColor={
            isDark ? 'rgba(17, 17, 16, 0.72)' : 'rgba(247, 246, 242, 0.72)'
          }
        />
      </ReactFlow>

      {/* Floating Bottom Editorial Toolbar */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)]">
        <div className="bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] rounded-md p-1.5 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => void handleCreateIdea()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-[#141413] hover:bg-[#2A2A27] dark:bg-[#F2F0E8] dark:hover:bg-[#E2E0D8] text-[#F7F6F2] dark:text-[#111110] font-mono text-xs font-semibold whitespace-nowrap transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span>+ Nouvelle Idée</span>
          </button>

          <button
            type="button"
            onClick={() => setResourceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-[#FCFBF9] hover:bg-[#F7F6F2] dark:bg-[#141413] dark:hover:bg-[#1E1E1B] border border-[#E2E0D8] dark:border-[#2A2A27] text-[#141413] dark:text-[#F2F0E8] font-mono text-xs font-medium whitespace-nowrap transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>+ Lien Article / YouTube</span>
          </button>

          <span className="h-5 w-px bg-[#E2E0D8] dark:bg-[#2A2A27] shrink-0" />

          <button
            type="button"
            onClick={exitPlanning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:bg-[#F7F6F2] dark:hover:bg-[#1E1E1B] font-mono text-xs font-medium whitespace-nowrap transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Quitter la planification</span>
          </button>
        </div>
      </div>

      <ResourceModal
        open={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        onCreateResource={handleCreateResource}
      />
    </div>
  );
}
