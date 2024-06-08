<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import gqlClient from '@/graphql-client'
import { BTable, BButton, TableItem } from 'bootstrap-vue-next'
import { fetchAllBranches, fetchCommitHistory } from '@/queries'

interface Commit {
  hash: string
  name: string
  date: string
}

interface BranchesWithCommits {
  [key: string]: Commit[]
}

const fields = [
  { key: 'name', label: 'Commit Name' },
  { key: 'view', label: '' }
]

const branchesWithCommits = ref<BranchesWithCommits>({})
const selectedCommits = ref<TableItem<Commit>[]>([])
const commitTableRef = ref<(InstanceType<typeof BTable> | null)[]>([]) // Reference to the BTable component
const isLoading = ref(false)

// Fetch all branches on component mount
onMounted(async () => {
  isLoading.value = true
  try {
    const response = await gqlClient.query({ query: fetchAllBranches })
    const branches = response.data.branches

    // Initialize an empty object to store commits for each branch
    const commitsByBranch: BranchesWithCommits = {}

    // Use a loop to fetch commits for each branch
    for (const branch of branches) {
      const commitResponse = await gqlClient.query({
        query: fetchCommitHistory,
        variables: { branchName: branch.name }
      })
      commitsByBranch[branch.name] = commitResponse.data.fetchCommitHistory
    }

    // Once all commit histories are fetched, update the reactive variable
    branchesWithCommits.value = commitsByBranch
  } catch (error) {
    console.error('Error fetching branches and commits:', error)
  } finally {
    isLoading.value = false
  }
})

function handleSelection(selections: TableItem<Commit>[]) {
  if (selections.length > 2) {
    // we need to unselect manually the last selection
    // identify the last selection
    const newSelections = selections.filter(
      (selection) => !selectedCommits.value.includes(selection)
    )
    const new_selection = newSelections[0]

    // if not undefined
    if (!new_selection) {
      return
    }
    // Find the index in the commits array for the branch
    let index = -1
    for (const branch in branchesWithCommits.value) {
      index = branchesWithCommits.value[branch].findIndex(
        (item: Commit) => item.hash === new_selection.hash
      )
      if (index !== -1) {
        break
      }
    }

    const commit_table = commitTableRef.value[0]
    // Ensure the commitTableRef is initialized
    if (commit_table && index !== -1) {
      commit_table.unselectRow(index)
      // remove new_selection from selections
      selections = selections.filter((selection) => selection.hash !== new_selection.hash)
    }
  }
  selectedCommits.value = selections
}

const diffViewLink = computed(() => {
  if (selectedCommits.value.length !== 2) {
    return {}
  }
  return {
    name: 'DiffView',
    params: {
      base_hash: selectedCommits.value[0]?.hash,
      diffee_hash: selectedCommits.value[1]?.hash
    },
    query: {
      base_name: selectedCommits.value[0]?.name,
      diffee_name: selectedCommits.value[1]?.name
    }
  }
})
</script>

<template>
  <main class="container mt-3">
    <h2 class="mb-4"><i class="bi bi-git"></i> Branches</h2>
    <div class="row">
      <div
        class="col-12 col-md-6 col-lg-4 mb-3"
        v-for="(commits, branchName) in branchesWithCommits"
        :key="branchName"
      >
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>{{ branchName }}</strong>
            <BButton
              variant="primary"
              class="ms-auto"
              :disabled="selectedCommits.length !== 2"
              :to="diffViewLink"
            >
              Diff
            </BButton>
          </div>
          <BTable
            ref="commitTableRef"
            :busy="isLoading"
            :items="commits"
            :fields="fields"
            :selectable="true"
            select-mode="multi"
            @selection="handleSelection"
          >
            <template #cell(view)="data">
              <BButton
                :to="{
                  name: 'OSView',
                  params: { os_hash: data.item.hash },
                  query: { os_title: data.item.name }
                }"
                variant="primary"
              >
                View
              </BButton>
            </template>
          </BTable>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
.badge {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75px;
  display: inline-block;
}
</style>
