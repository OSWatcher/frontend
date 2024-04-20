<script setup lang="ts">
import { onMounted, ref } from 'vue';
import gqlClient from '@/graphql-client';
import { gql } from '@apollo/client/core';

interface Commit {
  hash: string;
  name: string;
  date: string;
}

interface BranchesWithCommits {
  [key: string]: Commit[];
}

const branchesWithCommits = ref<BranchesWithCommits>({});

// fetch all branches
const fetchAllBranches = gql`
query {
  branches {
    name
  }
}
`;

// fetch commit history for a given branch
const fetchCommitHistory = gql`
query($branchName: String!) {
  fetchCommitHistory(branch_name: $branchName) {
    hash
    name
    date
  }
}
`;

// Fetch all branches on component mount
onMounted(async () => {
  try {
    const response = await gqlClient.query({ query: fetchAllBranches });
    const branches = response.data.branches;

    // Initialize an empty object to store commits for each branch
    const commitsByBranch: BranchesWithCommits = {};

    // Use a loop to fetch commits for each branch
    for (const branch of branches) {
      const commitResponse = await gqlClient.query({
        query: fetchCommitHistory,
        variables: { branchName: branch.name }
      });
      commitsByBranch[branch.name] = commitResponse.data.fetchCommitHistory;
    }

    // Once all commit histories are fetched, update the reactive variable
    branchesWithCommits.value = commitsByBranch;
  } catch (error) {
    console.error("Error fetching branches and commits:", error);
  }
});
</script>

<template>
  <main class="container mt-3">
    <h1 class="mb-4">Branches</h1>
    <div class="row">
      <div class="col-12 col-md-6 col-lg-4 mb-3" v-for="(commits, branchName) in branchesWithCommits" :key="branchName">
        <div class="card">
          <div class="card-header">
            <strong>{{ branchName }}</strong>
          </div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item" v-for="commit in commits" :key="commit.hash">
              {{ commit.name }}
              <br>
            </li>
          </ul>
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
