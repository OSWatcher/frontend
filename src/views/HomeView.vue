<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import gqlClient from '@/graphql-client'
import { BCard, BButton, TableItem } from 'bootstrap-vue-next'
import { fetchCommitHistory } from '@/queries'
import type { Commit, BranchesWithCommits } from '@/types'
import CommitTable from '@/components/CommitsTable.vue'

const MAIN_BRANCH: string = 'master'

const fields = [
  { key: 'name', label: 'Commit Name' },
  { key: 'view', label: '' }
]
// dictionary to store the commit history for each branch
const branchesWithCommits = ref<BranchesWithCommits>({})
const selectedCommits = ref<TableItem<Commit>[]>([])
const isLoading = ref(false)
const maintenanceMode = ref(false)

/*
fetches the commit history for master branch
and for each commit in the master branch, fetches the commit history as well, if any
stores the results in branchesWithCommits
*/
onMounted(async () => {
  isLoading.value = true
  try {
    const response = await gqlClient.query({
      query: fetchCommitHistory,
      variables: { branchName: MAIN_BRANCH }
    })

    // map each commit to a new object
    // otherwise  TypeError: can't define property "_showDetails": Object is not extensible
    // showing details for the commit
    branchesWithCommits.value[MAIN_BRANCH] = response.data.fetchCommitHistory.map((c: Commit) => ({
      ...c,
      selected: false
    }))

    // for each commit returned, try to fetch commit history, if any
    for (const commit of branchesWithCommits.value[MAIN_BRANCH]) {
      const response = await gqlClient.query({
        query: fetchCommitHistory,
        variables: { branchName: commit.name }
      })
      // test whether the response.data.fetchCommitHistory is an empty array
      if (response.data.fetchCommitHistory.length > 0) {
        // truncate the response up to commit with hash equal to commit.name (excluding it)
        const index = response.data.fetchCommitHistory.findIndex(
          (c: Commit) => c.hash === commit.hash
        )
        const data = response.data.fetchCommitHistory.slice(0, index)
        // map each commit to a new object
        // otherwise  TypeError: can't define property "_showDetails": Object is not extensible
        // showing details for the commit
        branchesWithCommits.value[commit.name] = data.map((c: Commit) => ({
          ...c,
          selected: false
        }))
      }
    }
  } catch (error) {
    console.error('Error fetching branches and commits:', error)
    maintenanceMode.value = true
  } finally {
    isLoading.value = false
  }
})

function handleCheckboxChange(item: Commit, checked: boolean) {
  item.selected = checked
  if (checked) {
    if (selectedCommits.value.length < 2) {
      selectedCommits.value.push(item)
    } else {
      alert('You can only select up to 2 commits.')
      item.selected = false
    }
  } else {
    selectedCommits.value = selectedCommits.value.filter((commit) => commit.hash !== item.hash)
  }
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
    <!-- Maintenance mode display -->
    <div v-if="maintenanceMode">
      <BCard>
        <h1><i class="bi bi-tools"></i> Maintenance</h1>
      </BCard>
    </div>

    <!-- Main content when not in maintenance mode -->
    <div v-else>
      <h2 class="mb-4"><i class="bi bi-git"></i> {{ MAIN_BRANCH }} Branch</h2>

      <!-- Main card containing the branch and commit information -->
      <div class="card">
        <!-- Card header with branch name and Diff button -->
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>{{ MAIN_BRANCH }}</strong>
          <BButton
            variant="primary"
            class="ms-auto"
            :disabled="selectedCommits.length !== 2"
            :to="diffViewLink"
          >
            Diff
          </BButton>
        </div>
        <CommitTable
          :branch="MAIN_BRANCH"
          :fields="fields"
          :branchesWithCommits="branchesWithCommits"
          :selectedCommits="selectedCommits"
          :isLoading="isLoading"
          @handleCheckboxChange="handleCheckboxChange"
        />
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
