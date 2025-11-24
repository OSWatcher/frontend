<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import type { BranchWithCommits } from '@/composables/useFetchHomeData'
import { useCommitSelectionStore } from '@/stores/commitSelection'
import { useFetchCommitHistoryQuery, CommitHistoryDirection } from '@/graphql-types'

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  branchesWithCommits: BranchWithCommits[]
  selectedBranch: string
}

interface CommitNode {
  id: string
  hash: string
  name: string
  date: Date
  description: string
  parentIds: string[]
  expandableCount: number
  expandableCommits: Array<{
    hash: string
    name?: string | null
    description?: string | null
    date?: string | null
  }>
}

type D3Selection = d3.Selection<SVGGElement, unknown, null, undefined>
type D3Circle = d3.Selection<SVGCircleElement, unknown, null, undefined>
type D3Rect = d3.Selection<SVGRectElement, unknown, null, undefined>

// ============================================================================
// CONFIGURATION - All magic numbers in one place
// ============================================================================

const CONFIG = {
  // Layout
  margin: { top: 40, right: 40, bottom: 40, left: 120 },
  minHeight: 400,

  // Sizing
  nodeRadius: 13,
  laneHeight: 72,
  updateSpacing: 72,
  updateIndent: 40,

  // Hover card
  hover: {
    bgColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 25,
    offsetY: -30,
    heightReduction: 4
  },

  // Circle
  circle: {
    selectedColor: '#10b981',
    defaultColor: '#3b82f6',
    stroke: 'white',
    strokeWidth: 2,
    hoverScale: 1.2
  },

  // Text
  text: {
    fontSize: 18,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    offsetX: 20,
    offsetY: 7,
    mainTruncateLength: 80,
    updateTruncateLength: 70,
    nameColor: '#000000',
    descColor: '#64748b',
    nameFontWeight: '600',
    descFontWeight: '400'
  },

  // Selection badge
  badge: {
    offsetY: -18,
    fontSize: 10,
    fontWeight: '600',
    color: 'white'
  },

  // View button
  viewButton: {
    width: 70,
    height: 30,
    offsetX: 80,
    offsetY: -15,
    bgColor: '#3b82f6',
    hoverBgColor: '#2563eb',
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    padding: '4px 12px',
    borderRadius: '4px'
  },

  // Expand indicator
  expandIndicator: {
    radius: 8,
    collapsedColor: '#f59e0b',
    expandedColor: '#10b981',
    offsetX: -25,
    fontSize: 14
  },

  // Lines
  line: {
    mainStroke: '#94a3b8',
    updateStroke: '#cbd5e1',
    width: 2,
    dashArray: '4,2'
  },

  // Animation
  transition: {
    duration: 150
  },

  // Loading
  loading: {
    fontSize: 14,
    color: '#64748b'
  }
}

// ============================================================================
// PURE HELPER FUNCTIONS - Testable, no side effects
// ============================================================================

/**
 * Truncates text to specified length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

/**
 * Formats commit text with name and optional description
 * Currently unused but kept for potential future use
 */
function _formatCommitText(name: string, description: string | null, maxLength: number) {
  if (!description) {
    return { display: name, tooltip: name }
  }

  const truncated = truncateText(description, maxLength)
  return {
    display: `${name} — ${truncated}`,
    tooltip: `${name} — ${description}`
  }
}

/**
 * Calculates total graph height including expanded commits
 */
function calculateTotalHeight(
  nodes: CommitNode[],
  expandedCommits: Set<string>,
  fetchedUpdateCommits: Map<string, any[]>
): number {
  let height = CONFIG.margin.top + CONFIG.margin.bottom

  nodes.forEach((node) => {
    height += CONFIG.laneHeight
    if (expandedCommits.has(node.hash)) {
      const updates = fetchedUpdateCommits.get(node.hash) || []
      height += updates.length * CONFIG.updateSpacing
    }
  })

  return Math.max(height, CONFIG.minHeight)
}

/**
 * Calculates Y positions for all nodes including expanded updates
 */
function calculateNodePositions(
  nodes: CommitNode[],
  expandedCommits: Set<string>,
  fetchedUpdateCommits: Map<string, any[]>
): number[] {
  let cumulativeY = 0

  return nodes.map((node) => {
    const y = cumulativeY
    cumulativeY += CONFIG.laneHeight

    if (expandedCommits.has(node.hash)) {
      const updates = fetchedUpdateCommits.get(node.hash) || []
      cumulativeY += updates.length * CONFIG.updateSpacing
    }

    return y
  })
}

/**
 * Gets the color for a commit circle based on selection state
 */
function getCommitColor(isSelected: boolean): string {
  return isSelected ? CONFIG.circle.selectedColor : CONFIG.circle.defaultColor
}

/**
 * Calculates row width from container width
 */
function calculateRowWidth(containerWidth: number): number {
  return containerWidth - CONFIG.margin.left - CONFIG.margin.right
}

// ============================================================================
// D3 RENDERING FUNCTIONS - Reusable, eliminate duplication
// ============================================================================

/**
 * Creates a hover background rectangle
 */
function createHoverBackground(group: D3Selection, width: number, offsetX: number = 0): D3Rect {
  return group
    .append('rect')
    .attr('x', -CONFIG.hover.padding)
    .attr('y', CONFIG.hover.offsetY)
    .attr('width', width + CONFIG.hover.padding * 2 - offsetX)
    .attr('height', CONFIG.laneHeight - CONFIG.hover.heightReduction)
    .attr('fill', CONFIG.hover.bgColor)
    .attr('stroke', CONFIG.hover.borderColor)
    .attr('stroke-width', CONFIG.hover.borderWidth)
    .attr('rx', CONFIG.hover.borderRadius)
    .style('opacity', 0)
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')
}

/**
 * Creates a commit circle
 */
function createCommitCircle(group: D3Selection, isSelected: boolean): D3Circle {
  return group
    .append('circle')
    .attr('r', CONFIG.nodeRadius)
    .attr('fill', getCommitColor(isSelected))
    .attr('stroke', CONFIG.circle.stroke)
    .attr('stroke-width', CONFIG.circle.strokeWidth)
    .style('cursor', 'pointer')
}

/**
 * Creates commit text with name and optional description
 */
function createCommitText(
  group: D3Selection,
  commit: { name: string; description: string; hash?: string },
  truncateLength: number
) {
  const text = group
    .append('text')
    .attr('x', CONFIG.text.offsetX)
    .attr('y', CONFIG.text.offsetY)
    .attr('font-size', `${CONFIG.text.fontSize}px`)
    .attr('font-family', CONFIG.text.fontFamily)
    .style('user-select', 'none')
    .style('pointer-events', 'none')

  // Add commit name
  text
    .append('tspan')
    .text(commit.name || commit.hash?.substring(0, 8) || '')
    .attr('font-weight', CONFIG.text.nameFontWeight)
    .attr('fill', CONFIG.text.nameColor)

  // Add description if exists
  if (commit.description) {
    const truncated = truncateText(commit.description, truncateLength)

    text
      .append('tspan')
      .text(' — ' + truncated)
      .attr('font-weight', CONFIG.text.descFontWeight)
      .attr('fill', CONFIG.text.descColor)

    // Add tooltip
    const tooltipText = commit.name
      ? `${commit.name} — ${commit.description}`
      : `${commit.hash} — ${commit.description}`
    text.append('title').text(tooltipText)
  }

  return text
}

/**
 * Creates a selection badge (Base/Diffee)
 */
function createSelectionBadge(group: D3Selection, label: string | null) {
  return group
    .append('text')
    .attr('x', 0)
    .attr('y', CONFIG.badge.offsetY)
    .attr('text-anchor', 'middle')
    .attr('font-size', `${CONFIG.badge.fontSize}px`)
    .attr('font-weight', CONFIG.badge.fontWeight)
    .attr('fill', CONFIG.badge.color)
    .style('opacity', label ? 1 : 0)
    .style('pointer-events', 'none')
    .text(label || '')
}

/**
 * Creates a View button
 */
function createViewButton(
  group: D3Selection,
  commitHash: string,
  rowWidth: number,
  offsetX: number = 0
) {
  const button = group
    .append('foreignObject')
    .attr('class', 'view-button')
    .attr('x', rowWidth - CONFIG.viewButton.offsetX - offsetX)
    .attr('y', CONFIG.viewButton.offsetY)
    .attr('width', CONFIG.viewButton.width)
    .attr('height', CONFIG.viewButton.height)
    .style('opacity', 0)
    .style('transition', `opacity ${CONFIG.transition.duration}ms`)
    .style('pointer-events', 'all')

  button
    .append('xhtml:a')
    .attr('href', `/os/${commitHash}`)
    .style('display', 'inline-block')
    .style('padding', CONFIG.viewButton.padding)
    .style('background', CONFIG.viewButton.bgColor)
    .style('color', CONFIG.viewButton.color)
    .style('text-decoration', 'none')
    .style('border-radius', CONFIG.viewButton.borderRadius)
    .style('font-size', `${CONFIG.viewButton.fontSize}px`)
    .style('font-family', CONFIG.text.fontFamily)
    .style('font-weight', CONFIG.viewButton.fontWeight)
    .style('cursor', 'pointer')
    .style('transition', `background ${CONFIG.transition.duration}ms`)
    .text('View')
    .on('mouseenter', function () {
      d3.select(this).style('background', CONFIG.viewButton.hoverBgColor)
    })
    .on('mouseleave', function () {
      d3.select(this).style('background', CONFIG.viewButton.bgColor)
    })

  return button
}

/**
 * Attaches hover effects to a commit row
 */
function attachHoverEffects(hoverBg: D3Rect, circle: D3Circle, onClick: (event: any) => void) {
  hoverBg
    .on('mouseenter', function () {
      d3.select(this).style('opacity', 1).transition().duration(CONFIG.transition.duration)
      circle
        .transition()
        .duration(CONFIG.transition.duration)
        .attr('r', CONFIG.nodeRadius * CONFIG.circle.hoverScale)
      d3.select(this.parentNode as any)
        .select('.view-button')
        .transition()
        .duration(CONFIG.transition.duration)
        .style('opacity', 1)
    })
    .on('mouseleave', function () {
      d3.select(this).transition().duration(CONFIG.transition.duration).style('opacity', 0)
      circle.transition().duration(CONFIG.transition.duration).attr('r', CONFIG.nodeRadius)
      d3.select(this.parentNode as any)
        .select('.view-button')
        .transition()
        .duration(CONFIG.transition.duration)
        .style('opacity', 0)
    })
    .on('click', onClick)
}

/**
 * Creates an expand/collapse indicator
 */
function createExpandIndicator(
  group: D3Selection,
  isExpanded: boolean,
  expandableCount: number,
  onClick: () => void
) {
  const indicator = group
    .append('g')
    .attr('transform', `translate(${CONFIG.expandIndicator.offsetX}, 0)`)
    .style('cursor', 'pointer')
    .on('click', function (event) {
      event.stopPropagation()
      onClick()
    })

  // Circle
  indicator
    .append('circle')
    .attr('r', CONFIG.expandIndicator.radius)
    .attr(
      'fill',
      isExpanded ? CONFIG.expandIndicator.expandedColor : CONFIG.expandIndicator.collapsedColor
    )
    .attr('stroke', CONFIG.circle.stroke)
    .attr('stroke-width', CONFIG.circle.strokeWidth)

  // Plus or minus sign
  indicator
    .append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', `${CONFIG.expandIndicator.fontSize}px`)
    .attr('font-weight', 'bold')
    .attr('fill', 'white')
    .text(isExpanded ? '−' : '+')

  // Tooltip
  const tooltipText = isExpanded
    ? 'Collapse updates'
    : `${expandableCount} update${expandableCount > 1 ? 's' : ''} available`
  indicator.append('title').text(tooltipText)
}

/**
 * Creates a connecting line between two points
 */
function createConnectingLine(
  g: D3Selection,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  isUpdate: boolean = false
) {
  const line = g
    .append('line')
    .attr('x1', x1)
    .attr('y1', y1)
    .attr('x2', x2)
    .attr('y2', y2)
    .attr('stroke', isUpdate ? CONFIG.line.updateStroke : CONFIG.line.mainStroke)
    .attr('stroke-width', CONFIG.line.width)

  if (isUpdate) {
    line.attr('stroke-dasharray', CONFIG.line.dashArray)
  }
}

/**
 * Creates a loading indicator
 */
function createLoadingIndicator(g: D3Selection, x: number, y: number) {
  const loadingGroup = g.append('g').attr('transform', `translate(${x}, ${y})`)

  loadingGroup
    .append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('font-size', `${CONFIG.loading.fontSize}px`)
    .attr('fill', CONFIG.loading.color)
    .attr('font-style', 'italic')
    .text('Loading update history...')
}

// ============================================================================
// COMPONENT STATE AND SETUP
// ============================================================================

const props = defineProps<Props>()
const commitSelection = useCommitSelectionStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

let isRendering = false
const expandedCommits = ref<Set<string>>(new Set())
const fetchedUpdateCommits = ref<Map<string, any[]>>(new Map())
const loadingUpdateCommits = ref<Set<string>>(new Set())

// ============================================================================
// BUSINESS LOGIC
// ============================================================================

/**
 * Builds commit nodes from branch data (pure function)
 */
function buildCommitNodes(): CommitNode[] {
  const currentBranch = props.branchesWithCommits.find(
    (b) => b.branch.name === props.selectedBranch
  )

  if (!currentBranch) return []

  const commits = currentBranch.commits
  if (!commits || commits.length === 0) return []

  return commits.map((commit) => ({
    id: commit.hash,
    hash: commit.hash,
    name: commit.name || '',
    date: new Date(commit.date),
    description: commit.description || '',
    parentIds: commit.next?.map((n) => n.hash).filter((h): h is string => !!h) || [],
    expandableCount: commit.expandableNextCommits?.length || 0,
    expandableCommits: commit.expandableNextCommits || []
  }))
}

/**
 * Toggles expansion of update commits
 */
async function toggleExpand(commitHash: string, firstUpdateHash: string) {
  if (expandedCommits.value.has(commitHash)) {
    // Collapse
    expandedCommits.value.delete(commitHash)
    nextTick(() => renderGraph())
  } else {
    // Expand
    expandedCommits.value.add(commitHash)

    // Fetch if not already cached
    if (!fetchedUpdateCommits.value.has(commitHash)) {
      loadingUpdateCommits.value.add(commitHash)

      try {
        const { result } = useFetchCommitHistoryQuery({
          commitHash: firstUpdateHash,
          direction: CommitHistoryDirection.Forward
        })

        await new Promise<void>((resolve) => {
          const unwatch = watch(
            result,
            (data) => {
              if (data?.fetchCommitHistory) {
                fetchedUpdateCommits.value.set(commitHash, data.fetchCommitHistory)
                unwatch()
                resolve()
              }
            },
            { immediate: true }
          )
        })
      } finally {
        loadingUpdateCommits.value.delete(commitHash)
      }
    }

    nextTick(() => renderGraph())
  }
}

// ============================================================================
// RENDERING FUNCTIONS - Broken down for maintainability
// ============================================================================

/**
 * Renders a single main commit
 */
function renderMainCommit(g: D3Selection, node: CommitNode, y: number, rowWidth: number) {
  const nodeGroup = g.append('g').attr('transform', `translate(0,${y})`)

  // Hover background
  const hoverBg = createHoverBackground(nodeGroup, rowWidth)

  // Circle
  const isSelected = commitSelection.isSelected(node.hash)
  const circle = createCommitCircle(nodeGroup, isSelected)

  // Click handler for circle
  circle.on('click', function (event) {
    event.stopPropagation()
    commitSelection.toggle(node.hash, node.name)
    d3.select(this).attr('fill', getCommitColor(commitSelection.isSelected(node.hash)))
    updateSelectionBadge()
  })

  // Selection badge
  const selectionLabel = commitSelection.getSelectionLabel(node.hash)
  const selectionBadge = createSelectionBadge(nodeGroup, selectionLabel)

  const updateSelectionBadge = () => {
    const label = commitSelection.getSelectionLabel(node.hash)
    selectionBadge.text(label || '').style('opacity', label ? 1 : 0)
  }

  // Hover effects
  attachHoverEffects(hoverBg, circle, (event: any) => {
    // Don't toggle if clicking on the View button
    if (event.target.tagName === 'A' || event.target.closest('a')) return
    event.stopPropagation()
    commitSelection.toggle(node.hash, node.name)
    circle.attr('fill', getCommitColor(commitSelection.isSelected(node.hash)))
    updateSelectionBadge()
  })

  // Text
  createCommitText(nodeGroup, node, CONFIG.text.mainTruncateLength)

  // Expand indicator
  if (node.expandableCount > 0) {
    const isExpanded = expandedCommits.value.has(node.hash)
    const firstUpdateHash = node.expandableCommits[0]?.hash

    createExpandIndicator(nodeGroup, isExpanded, node.expandableCount, () => {
      if (firstUpdateHash) {
        toggleExpand(node.hash, firstUpdateHash)
      }
    })
  }

  // View button
  createViewButton(nodeGroup, node.hash, rowWidth)
}

/**
 * Renders a single update commit
 */
function renderUpdateCommit(g: D3Selection, updateCommit: any, updateY: number, rowWidth: number) {
  const updateGroup = g
    .append('g')
    .attr('transform', `translate(${CONFIG.updateIndent},${updateY})`)

  // Hover background
  const updateHoverBg = createHoverBackground(updateGroup, rowWidth, CONFIG.updateIndent)

  // Circle
  const isSelected = commitSelection.isSelected(updateCommit.hash)
  const updateCircle = createCommitCircle(updateGroup, isSelected)

  // Click handler for circle
  updateCircle.on('click', function (event) {
    event.stopPropagation()
    commitSelection.toggle(updateCommit.hash, updateCommit.name)
    d3.select(this).attr('fill', getCommitColor(commitSelection.isSelected(updateCommit.hash)))
  })

  // Hover effects
  attachHoverEffects(updateHoverBg, updateCircle, (event: any) => {
    if (event.target.tagName === 'A' || event.target.closest('a')) return
    event.stopPropagation()
    commitSelection.toggle(updateCommit.hash, updateCommit.name)
    updateCircle.attr('fill', getCommitColor(commitSelection.isSelected(updateCommit.hash)))
  })

  // Text
  createCommitText(updateGroup, updateCommit, CONFIG.text.updateTruncateLength)

  // View button
  createViewButton(updateGroup, updateCommit.hash, rowWidth, CONFIG.updateIndent)
}

/**
 * Renders all update commits for a node
 */
function renderUpdateCommits(g: D3Selection, node: CommitNode, y: number, rowWidth: number) {
  const updateCommitsData = fetchedUpdateCommits.value.get(node.hash) || []
  const isLoading = loadingUpdateCommits.value.has(node.hash)

  if (isLoading) {
    createLoadingIndicator(g, CONFIG.updateIndent, y + CONFIG.laneHeight)
    return
  }

  if (updateCommitsData.length === 0) return

  updateCommitsData.forEach((updateCommit, updateIndex) => {
    const updateY = y + CONFIG.laneHeight + updateIndex * CONFIG.updateSpacing

    // Connecting line from main commit to first update
    if (updateIndex === 0) {
      createConnectingLine(
        g,
        0,
        y + CONFIG.nodeRadius,
        CONFIG.updateIndent,
        updateY - CONFIG.nodeRadius,
        true
      )
    }

    // Render the update commit
    renderUpdateCommit(g, updateCommit, updateY, rowWidth)

    // Vertical line between updates
    if (updateIndex < updateCommitsData.length - 1) {
      createConnectingLine(
        g,
        CONFIG.updateIndent,
        updateY + CONFIG.nodeRadius,
        CONFIG.updateIndent,
        updateY + CONFIG.updateSpacing - CONFIG.nodeRadius,
        true
      )
    }
  })
}

/**
 * Main rendering function - orchestrates the graph rendering
 */
function renderSimpleGraph(nodes: CommitNode[]) {
  if (!svgRef.value || !containerRef.value) return

  const width = containerRef.value.clientWidth
  const rowWidth = calculateRowWidth(width)

  // Calculate dimensions
  const totalHeight = calculateTotalHeight(nodes, expandedCommits.value, fetchedUpdateCommits.value)
  const nodePositions = calculateNodePositions(
    nodes,
    expandedCommits.value,
    fetchedUpdateCommits.value
  )

  // Setup SVG
  const svg = d3.select(svgRef.value).attr('width', width).attr('height', totalHeight)

  const g = svg
    .append('g')
    .attr('transform', `translate(${CONFIG.margin.left},${CONFIG.margin.top})`)

  // Render all commits
  nodes.forEach((node, i) => {
    const y = nodePositions[i]

    // Render main commit
    renderMainCommit(g, node, y, rowWidth)

    // Render expanded updates
    if (expandedCommits.value.has(node.hash)) {
      renderUpdateCommits(g, node, y, rowWidth)
    }

    // Draw line to next commit
    if (i < nodes.length - 1) {
      createConnectingLine(
        g,
        0,
        y + CONFIG.nodeRadius,
        0,
        nodePositions[i + 1] - CONFIG.nodeRadius,
        false
      )
    }
  })

  isRendering = false
}

/**
 * Main render entry point
 */
function renderGraph() {
  if (isRendering || !svgRef.value || !containerRef.value) return

  const nodes = buildCommitNodes()
  if (nodes.length === 0) return

  isRendering = true

  // Clear previous render
  d3.select(svgRef.value).selectAll('*').remove()

  // Render the graph
  renderSimpleGraph(nodes)
}

// ============================================================================
// LIFECYCLE AND WATCHERS
// ============================================================================

onMounted(() => {
  nextTick(() => renderGraph())
})

watch(
  () => props.selectedBranch,
  () => nextTick(() => renderGraph())
)

watch(
  () => {
    const currentBranch = props.branchesWithCommits.find(
      (b) => b.branch.name === props.selectedBranch
    )
    return currentBranch?.commits || []
  },
  (commits) => {
    if (commits.length > 0) {
      nextTick(() => renderGraph())
    }
  },
  { immediate: true }
)
</script>

<template>
  <div ref="containerRef" class="commit-graph-container">
    <svg ref="svgRef" class="commit-graph-svg"></svg>
  </div>
</template>

<style scoped>
.commit-graph-container {
  width: 100%;
  overflow-x: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.commit-graph-svg {
  display: block;
}
</style>
