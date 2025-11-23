<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import { graphStratify, sugiyama, decrossOpt, coordCenter } from 'd3-dag'
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
const margin = { top: 40, right: 40, bottom: 40, left: 100 }
const nodeRadius = 6
const laneHeight = 60

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

  const nodes: CommitNode[] = []
  const commits = currentBranch.commits.value

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

function renderGraph() {
  if (!svgRef.value || !containerRef.value) return

  const nodes = buildCommitNodes()
  if (nodes.length === 0) return

  // Clear previous render
  d3.select(svgRef.value).selectAll('*').remove()

  // Build DAG structure
  const stratify = graphStratify()

  // Create dag from nodes - for git commits, each node points to its parents
  const dagData = nodes.map(node => ({
    id: node.id,
    parentIds: node.parentIds.length > 0 ? node.parentIds : undefined
  }))

  let dag
  try {
    dag = stratify(dagData)
  } catch (err) {
    console.error('Error creating DAG:', err)
    // Fallback: simple vertical layout without d3-dag
    renderSimpleGraph(nodes)
    return
  }

  // Configure layout
  const layout = sugiyama()
    .decross(decrossOpt())
    .coord(coordCenter())
    .nodeSize([laneHeight, 150])

  const { width: dagWidth, height: dagHeight } = layout(dag)

  // Calculate SVG dimensions
  const width = containerRef.value.clientWidth
  const height = Math.max(dagHeight + margin.top + margin.bottom, 400)

  const svg = d3
    .select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Draw links (edges between commits)
  const links = g
    .append('g')
    .attr('class', 'links')
    .selectAll('path')
    .data(dag.links())
    .join('path')
    .attr('d', (link: any) => {
      const sourceX = link.source.x
      const sourceY = link.source.y
      const targetX = link.target.x
      const targetY = link.target.y

      return `M ${sourceY},${sourceX} L ${targetY},${targetX}`
    })
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 2)

  // Draw nodes (commits)
  const allNodes = Array.from(dag.nodes())
  const nodeGroups = g
    .append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(allNodes)
    .join('g')
    .attr('transform', (d: any) => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')

  // Add circles for commits
  nodeGroups
    .append('circle')
    .attr('r', nodeRadius)
    .attr('fill', (d: any) => {
      const node = nodes.find(n => n.id === d.data.id)
      return commitSelection.isSelected(node?.hash || '') ? '#10b981' : '#3b82f6'
    })
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    .on('click', (event: MouseEvent, d: any) => {
      const node = nodes.find(n => n.id === d.data.id)
      if (node) {
        commitSelection.toggle(node.hash)
        renderGraph() // Re-render to update colors
      }
    })
    .on('mouseenter', function() {
      d3.select(this).attr('r', nodeRadius * 1.5)
    })
    .on('mouseleave', function() {
      d3.select(this).attr('r', nodeRadius)
    })

  // Add labels for commits
  nodeGroups
    .append('text')
    .attr('x', 12)
    .attr('y', 4)
    .text((d: any) => {
      const node = nodes.find(n => n.id === d.data.id)
      return node?.name || ''
    })
    .attr('font-size', '12px')
    .attr('font-family', 'system-ui, -apple-system, sans-serif')
    .style('pointer-events', 'none')

  // Add tooltips
  nodeGroups.append('title').text((d: any) => {
    const node = nodes.find(n => n.id === d.data.id)
    if (!node) return ''
    return `${node.name}\n${node.date.toLocaleString()}\n${node.description}`
  })
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

    // Draw node
    const nodeGroup = g.append('g').attr('transform', `translate(0,${y})`)

    nodeGroup
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', commitSelection.isSelected(node.hash) ? '#10b981' : '#3b82f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', () => {
        commitSelection.toggle(node.hash)
        renderGraph()
      })

    nodeGroup
      .append('text')
      .attr('x', 12)
      .attr('y', 4)
      .text(node.name)
      .attr('font-size', '12px')

    // Draw line to next commit
    if (i < nodes.length - 1) {
      g.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', 0)
        .attr('y2', (i + 1) * laneHeight)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
    }
  })
}

// Initial render and watch for changes
onMounted(() => {
  nextTick(() => {
    renderGraph()
  })

  // Re-render on window resize
  window.addEventListener('resize', renderGraph)
})

watch(
  () => [props.branchesWithCommits, props.selectedBranch],
  () => {
    nextTick(() => {
      renderGraph()
    })
  },
  { deep: true }
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
