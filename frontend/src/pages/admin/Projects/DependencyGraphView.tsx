import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import type { DependencyGraph, ProjectCell } from '@/types/projectWorkspace'
import {
  assignLayers,
  buildDepMap,
  GRAPH_COL_GAP,
  GRAPH_NODE_H,
  GRAPH_NODE_W,
  GRAPH_PAD,
  GRAPH_ROW_GAP,
  manhattanPath,
  nodeProgressPercent,
  nodeStatusBadge,
  shortNodeId,
} from '@/components/employee/projects/employeeDependencyGraphUtils'
import '@/components/employee/projects/employeeDependencyGraph.css'

type GraphNode = DependencyGraph['nodes'][number] & {
  x: number
  y: number
}

type DependencyGraphViewProps = {
  graph: DependencyGraph
  cellsById?: Record<string, ProjectCell>
  projectId?: string
  getCellPath?: (projectId: string, cellId: string) => string
}

function GraphNodeCard({
  node,
  cell,
  onOpen,
}: {
  node: GraphNode
  cell?: ProjectCell
  onOpen: (cellId: string) => void
}) {
  const badge = nodeStatusBadge(node, cell)
  const progress = nodeProgressPercent(cell)

  return (
    <button
      type="button"
      className="emp-dep-graph-node"
      onClick={() => onOpen(node.id)}
      aria-label={`Open cell ${node.name}`}
    >
      <div className="emp-dep-graph-node-head">
        <p className="emp-dep-graph-node-id">{shortNodeId(node.id)}</p>
        <span className={`emp-dep-graph-node-badge emp-dep-graph-node-badge--${badge.tone}`}>
          <span className="emp-dep-graph-node-badge-dot" aria-hidden />
          {badge.label}
        </span>
      </div>
      <p className="emp-dep-graph-node-title" title={node.name}>
        {node.name}
      </p>
      <div className="emp-dep-graph-node-foot">
        <div className="emp-dep-graph-node-progress-track" aria-hidden>
          <span className="emp-dep-graph-node-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </button>
  )
}

export function DependencyGraphView({
  graph,
  cellsById = {},
  projectId,
  getCellPath,
}: DependencyGraphViewProps) {
  const navigate = useNavigate()

  const layout = useMemo(() => {
    const nodeIds = graph.nodes.map((n) => n.id)
    const deps = buildDepMap(graph.edges)
    const layers = assignLayers(nodeIds, deps)

    const byLayer = new Map<number, DependencyGraph['nodes']>()
    for (const node of graph.nodes) {
      const layer = layers.get(node.id) ?? 0
      const list = byLayer.get(layer) ?? []
      list.push(node)
      byLayer.set(layer, list)
    }

    const layerKeys = [...byLayer.keys()].sort((a, b) => a - b)
    const maxColumnHeight = Math.max(
      ...layerKeys.map((layer) => {
        const count = byLayer.get(layer)?.length ?? 0
        return count * GRAPH_NODE_H + Math.max(0, count - 1) * GRAPH_ROW_GAP
      }),
      GRAPH_NODE_H,
    )

    const positioned: GraphNode[] = layerKeys.flatMap((layer) => {
      const nodes = (byLayer.get(layer) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const columnHeight = nodes.length * GRAPH_NODE_H + Math.max(0, nodes.length - 1) * GRAPH_ROW_GAP
      return nodes.map((node, row) => ({
        ...node,
        x: GRAPH_PAD + layer * (GRAPH_NODE_W + GRAPH_COL_GAP),
        y: GRAPH_PAD + (maxColumnHeight - columnHeight) / 2 + row * (GRAPH_NODE_H + GRAPH_ROW_GAP),
      }))
    })

    const posMap = new Map(positioned.map((n) => [n.id, n]))
    const edgePaths = graph.edges
      .map((edge) => {
        const from = posMap.get(edge.from)
        const to = posMap.get(edge.to)
        if (!from || !to) return null
        return {
          key: `${edge.from}-${edge.to}`,
          d: manhattanPath(from.x + GRAPH_NODE_W, from.y + GRAPH_NODE_H / 2, to.x, to.y + GRAPH_NODE_H / 2),
          x1: from.x + GRAPH_NODE_W,
          y1: from.y + GRAPH_NODE_H / 2,
          x2: to.x,
          y2: to.y + GRAPH_NODE_H / 2,
        }
      })
      .filter(Boolean) as {
      key: string
      d: string
      x1: number
      y1: number
      x2: number
      y2: number
    }[]

    const maxLayer = layerKeys.length ? Math.max(...layerKeys) : 0
    const contentHeight = GRAPH_PAD * 2 + maxColumnHeight + 24

    return {
      nodes: positioned,
      edgePaths,
      width: Math.max(GRAPH_PAD * 2 + (maxLayer + 1) * GRAPH_NODE_W + maxLayer * GRAPH_COL_GAP, 560),
      height: Math.max(contentHeight, 400),
      hasEdges: edgePaths.length > 0,
      isWide: maxLayer > 0 || positioned.length > 2,
    }
  }, [graph])

  const openCell = (cellId: string) => {
    if (!projectId) return
    const path = getCellPath
      ? getCellPath(projectId, cellId)
      : ROUTES.PROJECT_CELL(projectId, cellId)
    navigate(path)
  }

  if (!graph.nodes.length) {
    return <p className="emp-dep-graph-empty">Add cells with dependencies to see the graph.</p>
  }

  return (
    <div className="emp-dep-graph-panel">
      <div className="emp-dep-graph-legend" aria-label="Graph legend">
        <span className="emp-dep-graph-legend-item">
          <span className="emp-dep-graph-legend-line" />
          Dependency
        </span>
      </div>

      <div className="emp-dep-graph-wrap">
        <svg
          className="emp-dep-graph-canvas"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMinYMin meet"
        >
          <defs>
            <marker id="admin-dep-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8" />
            </marker>
          </defs>

          {layout.edgePaths.map((edge) => (
            <g key={edge.key}>
              <path
                d={edge.d}
                className="emp-dep-graph-edge"
                markerEnd="url(#admin-dep-arrow)"
              />
              <circle cx={edge.x1} cy={edge.y1} r="3" className="emp-dep-graph-port" />
              <circle cx={edge.x2} cy={edge.y2} r="3" className="emp-dep-graph-port" />
            </g>
          ))}

          {layout.nodes.map((node) => (
            <foreignObject
              key={node.id}
              x={node.x}
              y={node.y}
              width={GRAPH_NODE_W}
              height={GRAPH_NODE_H}
              xmlns="http://www.w3.org/1999/xhtml"
            >
              <GraphNodeCard node={node} cell={cellsById[node.id]} onOpen={openCell} />
            </foreignObject>
          ))}
        </svg>

        {!layout.hasEdges ? (
          <p className="emp-dep-graph-scroll-hint">
            No downstream dependencies yet. Link cells to build the workflow map.
          </p>
        ) : layout.isWide ? (
          <p className="emp-dep-graph-scroll-hint">Scroll horizontally to view all connected cells.</p>
        ) : null}
      </div>
    </div>
  )
}
