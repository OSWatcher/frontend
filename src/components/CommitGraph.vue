<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import type { BranchWithCommits } from '@/composables/useFetchHomeData'
import { useCommitSelectionStore } from '@/stores/commitSelection'

interface Props {
  branchesWithCommits: BranchWithCommits[]
  selectedBranch: string
}

const props = defineProps<Props>()
const commitSelection = useCommitSelectionStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Graph dimensions
const margin = { top: 40, right: 40, bottom: 40, left: 120 }
const nodeRadius = 13
const laneHeight = 72

interface CommitNode {
  id: string
  hash: string
  name: string
  date: Date
  description: string
  parentIds: string[]
}

function buildCommitNodes(): CommitNode[] {
  const currentBranch = props.branchesWithCommits.find(
    (b) => b.branch.name === props.selectedBranch
  )

  if (!currentBranch) return []

  // commits is already unwrapped by Vue props
  const commits = currentBranch.commits

  if (!commits || commits.length === 0) return []

  const nodes: CommitNode[] = []

  commits.forEach((commit) => {
    // Get parent IDs from the 'next' field (since we're going backward in history)
    const parentIds = commit.next?.map((n) => n.hash).filter((h): h is string => !!h) || []

    nodes.push({
      id: commit.hash,
      hash: commit.hash,
      name: commit.name || '',
      date: new Date(commit.date),
      description: commit.description || '',
      parentIds
    })
  })

  return nodes
}

let isRendering = false

function renderGraph() {
  if (isRendering) {
    return
  }

  if (!svgRef.value) {
    return
  }

  if (!containerRef.value) {
    return
  }

  const nodes = buildCommitNodes()

  if (nodes.length === 0) {
    return
  }

  isRendering = true

  // Clear previous render
  d3.select(svgRef.value).selectAll('*').remove()

  // Use simple vertical layout
  // TODO: Implement proper DAG layout with d3-dag for showing merges and branches
  renderSimpleGraph(nodes)
}

function renderSimpleGraph(nodes: CommitNode[]) {
  if (!svgRef.value || !containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = Math.max(nodes.length * laneHeight + margin.top + margin.bottom, 400)

  const svg = d3
    .select(svgRef.value)
    .attr('width', width)
    .attr('height', height)

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Simple vertical layout
  nodes.forEach((node, i) => {
    const y = i * laneHeight
    const rowWidth = width - margin.left - margin.right

    // Draw node group (container for entire commit row)
    const nodeGroup = g
      .append('g')
      .attr('transform', `translate(0,${y})`)

    // Background rectangle for hover effect
    const hoverBg = nodeGroup
      .append('rect')
      .attr('x', -20)
      .attr('y', -25)
      .attr('width', rowWidth + 40)
      .attr('height', laneHeight - 10)
      .attr('fill', '#f8fafc')
      .attr('rx', 6)
      .style('opacity', 0)
      .style('transition', 'opacity 0.15s')

    // Draw commit circle
    const circle = nodeGroup
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', commitSelection.isSelected(node.hash) ? '#10b981' : '#3b82f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', function(event) {
        event.stopPropagation()
        commitSelection.toggle(node.hash)
        // Update circle color and selection badge
        d3.select(this)
          .attr('fill', commitSelection.isSelected(node.hash) ? '#10b981' : '#3b82f6')
        updateSelectionBadge()
      })

    // Selection badge (Base/Diffee)
    const selectionLabel = commitSelection.getSelectionLabel(node.hash)
    const selectionBadge = nodeGroup
      .append('text')
      .attr('x', 0)
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .style('opacity', selectionLabel ? 1 : 0)
      .text(selectionLabel || '')

    const updateSelectionBadge = () => {
      const label = commitSelection.getSelectionLabel(node.hash)
      selectionBadge.text(label || '').style('opacity', label ? 1 : 0)
    }

    // Hover effects
    nodeGroup
      .on('mouseenter', function() {
        hoverBg.style('opacity', 1)
        circle.attr('r', nodeRadius * 1.3)
        d3.select(this).select('.view-button').style('opacity', 1)
      })
      .on('mouseleave', function() {
        hoverBg.style('opacity', 0)
        circle.attr('r', nodeRadius)
        d3.select(this).select('.view-button').style('opacity', 0)
      })

    // Draw commit on a single line (name + description)
    const commitText = nodeGroup
      .append('text')
      .attr('x', 20)
      .attr('y', 7)
      .attr('font-size', '18px')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .style('user-select', 'none')

    // Add commit name (bold, dark)
    commitText
      .append('tspan')
      .text(node.name)
      .attr('font-weight', '600')
      .attr('fill', '#000000')

    // Add description (normal weight, gray) if it exists
    if (node.description) {
      const truncatedDesc = node.description.length > 80
        ? node.description.substring(0, 80) + '...'
        : node.description

      commitText
        .append('tspan')
        .text(' — ' + truncatedDesc)
        .attr('font-weight', '400')
        .attr('fill', '#64748b')

      // Add tooltip with full text
      commitText.append('title').text(`${node.name} — ${node.description}`)
    }

    // View button (appears on hover)
    const viewButton = nodeGroup
      .append('foreignObject')
      .attr('class', 'view-button')
      .attr('x', rowWidth - 80)
      .attr('y', -15)
      .attr('width', 70)
      .attr('height', 30)
      .style('opacity', 0)
      .style('transition', 'opacity 0.15s')
      .style('pointer-events', 'all')

    viewButton
      .append('xhtml:a')
      .attr('href', `/os/${node.hash}`)
      .style('display', 'inline-block')
      .style('padding', '4px 12px')
      .style('background', '#3b82f6')
      .style('color', 'white')
      .style('text-decoration', 'none')
      .style('border-radius', '4px')
      .style('font-size', '14px')
      .style('font-family', 'system-ui, -apple-system, sans-serif')
      .style('font-weight', '500')
      .style('cursor', 'pointer')
      .style('transition', 'background 0.15s')
      .text('View')
      .on('mouseenter', function() {
        d3.select(this).style('background', '#2563eb')
      })
      .on('mouseleave', function() {
        d3.select(this).style('background', '#3b82f6')
      })

    // Draw line to next commit (from bottom of current circle to top of next circle)
    if (i < nodes.length - 1) {
      g.append('line')
        .attr('x1', 0)
        .attr('y1', y + nodeRadius)
        .attr('x2', 0)
        .attr('y2', (i + 1) * laneHeight - nodeRadius)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
    }
  })

  isRendering = false
}

// Initial render
onMounted(() => {
  nextTick(() => {
    renderGraph()
  })
})

// Watch for branch selection changes
watch(
  () => props.selectedBranch,
  () => {
    nextTick(() => {
      renderGraph()
    })
  }
)

// Watch for commits of the currently selected branch
watch(
  () => {
    const currentBranch = props.branchesWithCommits.find(
      (b) => b.branch.name === props.selectedBranch
    )

    // Note: commits is already unwrapped by Vue props, no need for .value
    const commits = currentBranch?.commits || []
    return commits
  },
  (commits) => {
    if (commits.length > 0) {
      nextTick(() => {
        renderGraph()
      })
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
  border-radius: 8px;
}

.commit-graph-svg {
  display: block;
}
</style>
