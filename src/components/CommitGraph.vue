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

    // Draw node group (make entire group clickable)
    const nodeGroup = g
      .append('g')
      .attr('transform', `translate(0,${y})`)
      .style('cursor', 'pointer')
      .on('click', function() {
        commitSelection.toggle(node.hash)
        // Update circle color directly
        d3.select(this)
          .select('circle')
          .attr('fill', commitSelection.isSelected(node.hash) ? '#10b981' : '#3b82f6')
      })
      .on('mouseenter', function() {
        d3.select(this).select('circle').attr('r', nodeRadius * 1.3)
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle').attr('r', nodeRadius)
      })

    // Draw commit circle
    nodeGroup
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', commitSelection.isSelected(node.hash) ? '#10b981' : '#3b82f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)

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
