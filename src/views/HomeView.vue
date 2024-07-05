<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import gqlClient from '@/graphql-client'
import { BCard, BTable, BButton, TableItem, BFormCheckbox, BButtonGroup } from 'bootstrap-vue-next'
import { fetchCommitHistory } from '@/queries'

const MAIN_BRANCH: string = 'master'

interface Commit {
  hash: string
  name: string
  date: string
  selected?: boolean
}

// store the commit history for each branch
interface BranchesWithCommits {
  [key: string]: Commit[]
}

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
          <BButton variant="primary" class="ms-auto" :disabled="selectedCommits.length !== 2" :to="diffViewLink">
            Diff
          </BButton>
        </div>

        <!-- Main table displaying commits from the main branch -->
        <BTable :busy="isLoading" :items="branchesWithCommits[MAIN_BRANCH]" :fields="fields" responsive="md"
          select-mode="multi">
          <!-- Scoped slot for the 'name' field including the toggle button -->
          <template #cell(name)="row">
            <b-button v-if="branchesWithCommits[row.item.name]" @click="row.toggleDetails" class="me-2"
              :variant="row.detailsShowing ? 'outline-secondary' : 'outline-success'" size="sm">
              <i :class="row.detailsShowing ? 'bi-three-dots' : 'bi-plus-lg'"></i>
            </b-button>
            <span v-else class="me-2 d-inline-block" style="width: 24px"></span>
            {{ row.item.name }}
          </template>

          <!-- Custom cell for View button -->
          <template #cell(view)="data">
            <div class="d-flex justify-content-center align-items-center">
              <BButtonGroup>
                <BButton :to="{
                  name: 'OSView',
                  params: { os_hash: data.item.hash },
                  query: { os_title: data.item.name }
                }" variant="primary">
                  View
                </BButton>
                <BFormCheckbox v-model="data.item.selected"
                  @change="handleCheckboxChange(data.item, $event.target.checked)"
                  :disabled="!data.item.selected && selectedCommits.length >= 2" button
                  button-variant="outline-warning">
                  <i class="bi bi-file-diff-fill"></i>Diff
                </BFormCheckbox>
              </BButtonGroup>
            </div>
          </template>

          <!-- Row details template for expanded commits (associated branches) -->
          <template #row-details="row">
            <BTable v-if="branchesWithCommits[row.item.name]" :items="branchesWithCommits[row.item.name]"
              :fields="fields" select-mode="multi">
              <template #cell(name)="subrow">
                <b-button v-if="branchesWithCommits[subrow.item.name]" @click="row.toggleDetails" class="me-2"
                  :variant="row.detailsShowing ? 'outline-secondary' : 'outline-success'" size="sm">
                  <i :class="row.detailsShowing ? 'bi-three-dots' : 'bi-plus-lg'"></i>
                </b-button>
                <span v-else class="me-2 d-inline-block" style="width: 24px"></span>
                <!-- Placeholder element -->
                {{ subrow.item.name }}
              </template>

              <template #cell(view)="data">
                <div class="d-flex justify-content-center align-items-center">
                  <BButtonGroup>
                    <BButton :to="{
                      name: 'OSView',
                      params: { os_hash: data.item.hash },
                      query: { os_title: data.item.name }
                    }" variant="primary">
                      View
                    </BButton>
                    <BFormCheckbox v-model="data.item.selected"
                      @change="handleCheckboxChange(data.item, $event.target.checked)"
                      :disabled="!data.item.selected && selectedCommits.length >= 2" button
                      button-variant="outline-warning">
                      <i class="bi bi-file-diff-fill"></i>Diff
                    </BFormCheckbox>
                  </BButtonGroup>
                </div>
              </template>
            </BTable>
          </template>
        </BTable>
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

.b-table {
  margin-bottom: 0rem;
}
</style>
