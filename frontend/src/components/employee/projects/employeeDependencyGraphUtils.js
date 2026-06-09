import { getViewProgressStatus, LAYOUT_STAGES, normalizeWorkflow } from '@/utils/cellWorkflowUi'

export const GRAPH_NODE_W = 212
export const GRAPH_NODE_H = 96
export const GRAPH_COL_GAP = 88
export const GRAPH_ROW_GAP = 24
export const GRAPH_PAD = 28

export function buildDepMap(edges = []) {
  const deps = new Map()
  for (const edge of edges) {
    const list = deps.get(edge.to) ?? []
    list.push(edge.from)
    deps.set(edge.to, list)
  }
  return deps
}

export function assignLayers(nodeIds = [], deps = new Map()) {
  const layer = new Map()
  const visiting = new Set()

  const getLayer = (id) => {
    if (layer.has(id)) return layer.get(id)
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

/** Longest-path nodes and consecutive critical edges in the DAG */
export function computeCriticalPath(nodeIds = [], edges = []) {
  if (!nodeIds.length) {
    return { nodeIds: new Set(), edgeKeys: new Set() }
  }

  const incoming = new Map(nodeIds.map((id) => [id, []]))
  const outgoing = new Map(nodeIds.map((id) => [id, []]))
  const indegree = new Map(nodeIds.map((id) => [id, 0]))

  for (const edge of edges) {
    if (!incoming.has(edge.to) || !outgoing.has(edge.from)) continue
    incoming.get(edge.to).push(edge.from)
    outgoing.get(edge.from).push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1)
  }

  const dist = new Map(nodeIds.map((id) => [id, 0]))
  const pred = new Map(nodeIds.map((id) => [id, null]))
  const queue = nodeIds.filter((id) => (indegree.get(id) || 0) === 0)

  while (queue.length) {
    const current = queue.shift()
    const nextDist = (dist.get(current) || 0) + 1
    for (const child of outgoing.get(current) || []) {
      if (nextDist > (dist.get(child) || 0)) {
        dist.set(child, nextDist)
        pred.set(child, current)
      }
      indegree.set(child, (indegree.get(child) || 0) - 1)
      if (indegree.get(child) === 0) queue.push(child)
    }
  }

  let endNode = nodeIds[0]
  let maxDist = dist.get(endNode) || 0
  for (const id of nodeIds) {
    const value = dist.get(id) || 0
    if (value >= maxDist) {
      maxDist = value
      endNode = id
    }
  }

  const criticalNodes = new Set()
  const criticalEdges = new Set()
  let cursor = endNode
  while (cursor) {
    criticalNodes.add(cursor)
    const parent = pred.get(cursor)
    if (parent) criticalEdges.add(`${parent}-${cursor}`)
    cursor = parent
  }

  return { nodeIds: criticalNodes, edgeKeys: criticalEdges }
}

export function nodeStatusBadge(node, cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  if (wf.layout.pendingReview) return { label: 'REVIEW', tone: 'review' }
  const layoutStatus = getViewProgressStatus(cell || node, 'layout')
  if (layoutStatus === 'completed' || node.status === 'completed') return { label: 'DONE', tone: 'done' }
  if (wf.layout.stage === 'lvs_r2') return { label: 'LVS', tone: 'lvs' }
  if (layoutStatus === 'in_progress' || node.status === 'in_progress') return { label: 'WIP', tone: 'wip' }
  if (node.isBlocked) return { label: 'BLOCKED', tone: 'blocked' }
  return { label: 'IDLE', tone: 'idle' }
}

export function nodeProgressPercent(cell) {
  if (!cell) return 0
  const status = getViewProgressStatus(cell, 'layout')
  if (status === 'completed') return 100
  if (status === 'in_progress') {
    const wf = normalizeWorkflow(cell.viewWorkflow)
    const stageIdx = LAYOUT_STAGES.indexOf(wf.layout.stage)
    if (stageIdx < 0) return 35
    return Math.min(95, Math.round(((stageIdx + 1) / LAYOUT_STAGES.length) * 100))
  }
  return 0
}

export function shortNodeId(id = '') {
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length <= 7) return clean
  return `${clean.slice(0, 7)}…`
}

export function manhattanPath(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
}
