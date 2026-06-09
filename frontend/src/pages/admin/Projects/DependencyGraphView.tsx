import { useMemo } from 'react'
import type { CellStatus, DependencyGraph } from '@/types/projectWorkspace'
import './dependencyGraph.css'

const NODE_W = 148
const NODE_H = 56
const COL_GAP = 72
const ROW_GAP = 20
const PAD = 20

const STATUS_LABEL: Record<CellStatus, string> = {
  ready: 'In Progress',
  in_progress: 'In Progress',
  completed: 'Complete',
}

function buildDepMap(edges: DependencyGraph['edges']) {
  const deps = new Map<string, string[]>()
  for (const edge of edges) {
    const list = deps.get(edge.to) ?? []
    list.push(edge.from)
    deps.set(edge.to, list)
  }
  return deps
}

function assignLayers(nodeIds: string[], deps: Map<string, string[]>) {
  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const getLayer = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!
    if (visiting.has(id)) return 0
    visiting.add(id)
    const parents = deps.get(id) ?? []
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(getLayer)) + 1
    layer.set(id, value)
    visiting.delete(id)
    return value
  }
  for (const id of nodeIds) getLayer(id)
  return layer
}

function manhattanPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
}

export function DependencyGraphView({ graph }: { graph: DependencyGraph }) {
  const layout = useMemo(() => {
    const nodeIds = graph.nodes.map((n) => n.id)
    const deps = buildDepMap(graph.edges)
    const layers = assignLayers(nodeIds, deps)
    const byLayer = new Map<number, typeof graph.nodes>()
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
        return count * NODE_H + Math.max(0, count - 1) * ROW_GAP
      }),
      NODE_H,
    )
    const positioned = layerKeys.flatMap((layer) => {
      const nodes = (byLayer.get(layer) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const columnHeight = nodes.length * NODE_H + Math.max(0, nodes.length - 1) * ROW_GAP
      return nodes.map((node, row) => ({
        ...node,
        x: PAD + layer * (NODE_W + COL_GAP),
        y: PAD + (maxColumnHeight - columnHeight) / 2 + row * (NODE_H + ROW_GAP),
      }))
    })
    const posMap = new Map(positioned.map((n) => [n.id, n]))
    const edgePaths = graph.edges.map((edge) => {
      const from = posMap.get(edge.from)
      const to = posMap.get(edge.to)
      if (!from || !to) return null
      return {
        key: `${edge.from}-${edge.to}`,
        d: manhattanPath(from.x + NODE_W, from.y + NODE_H / 2, to.x, to.y + NODE_H / 2),
        x1: from.x + NODE_W,
        y1: from.y + NODE_H / 2,
        x2: to.x,
        y2: to.y + NODE_H / 2,
      }
    }).filter(Boolean) as { key: string; d: string; x1: number; y1: number; x2: number; y2: number }[]
    const maxLayer = layerKeys.length ? Math.max(...layerKeys) : 0
    return {
      nodes: positioned,
      edgePaths,
      width: Math.max(PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP, 400),
      height: Math.max(PAD * 2 + maxColumnHeight, 180),
    }
  }, [graph])

  if (!graph.nodes.length) {
    return <p className="dep-graph-empty">Add cells with dependencies to see the graph.</p>
  }

  return (
    <div className="dep-graph-canvas-wrap dep-graph-canvas-wrap--full">
      <svg className="dep-graph-canvas" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMinYMin meet">
        <defs>
          <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
          </marker>
        </defs>
        {layout.edgePaths.map((edge) => (
          <g key={edge.key}>
            <path d={edge.d} className="dep-graph-edge" markerEnd="url(#dep-arrow)" fill="none" />
            <circle cx={edge.x1} cy={edge.y1} r="2.5" className="dep-graph-port" />
            <circle cx={edge.x2} cy={edge.y2} r="2.5" className="dep-graph-port" />
          </g>
        ))}
        {layout.nodes.map((node) => (
          <foreignObject key={node.id} x={node.x} y={node.y} width={NODE_W} height={NODE_H}>
            <div className={[
              'dep-graph-node',
              node.isBlocked ? 'dep-graph-node--blocked' : '',
              node.isReady ? 'dep-graph-node--ready' : '',
              node.status === 'completed' ? 'dep-graph-node--done' : '',
            ].filter(Boolean).join(' ')}>
              <p className="dep-graph-node-title">{node.name}</p>
              <p className="dep-graph-node-status">
                {node.isBlocked ? 'Archive' : STATUS_LABEL[node.status]}
              </p>
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  )
}
