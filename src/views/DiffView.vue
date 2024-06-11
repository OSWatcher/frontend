<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onMounted, ref } from 'vue'
import { BCard, BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import gqlClient from '@/graphql-client'
import TreeNodeType from '@/types'
import { GET_FS_ROOT, DIFF_COMMITS } from '@/queries'
import TreeExplorer from '@/components/TreeExplorer.vue'
import { getDownloadUrl } from '@/download'

enum DiffType {
  NEW,
  MOD,
  DEL
}

interface DiffObj {
  name: string
  type: TreeNodeType
  diffType: DiffType
  old_hash: string | null
  new_hash: string | null
  _rowVariant: string
}

// get route params
const route = useRoute()
const base_commit = {
  hash: route.params.base_hash,
  name: route.query.base_name,
  fs_root_hash: ''
}
const diffee_commit = {
  hash: route.params.diffee_hash,
  name: route.query.diffee_name,
  fs_root_hash: ''
}
// tree explorer
const fields = [{ key: 'name', sortable: true }]
// our current path
const at_path = ref('/')

async function diffFsAt(new_path: string) {
  try {
    const response = await gqlClient.query({
      query: DIFF_COMMITS,
      variables: {
        baseCommitHash: base_commit.hash,
        diffeeCommitHash: diffee_commit.hash,
        path: new_path,
        maxDepth: 0
      }
    })
    return parse_diff_reponse(response)
  } catch (error) {
    console.error('Error fetching filesystem diff at path: ', error)
  }
}

// app logic
function parse_diff_reponse(response: any): DiffObj[] {
  /* sample data
{
  "data": {
    "diffCommitsAt": {
      "newitems": [],
      "moditems": [
        {
          "path": "pagefile.sys",
          "type": "BLOB",
          "old_hash": "e54bbcfba0fd4c05ea20d30221fed6b6b296229f",
          "new_hash": "c85a61c40538fdbab4e5bc414491499fa9b22ecd"
        },
        {
          "path": "System Volume Information",
          "type": "TREE",
          "old_hash": "5973de3656a2afe1b98d92b780e0f78168c1b18f",
          "new_hash": "32a03e4b7302f1e7d2330ae680b41016125e09e8"
        },
        ...
      ],
      "delitems": [
        {
          "path": "hiberfil.sys",
          "type": "BLOB",
          "old_hash": "ff6bf70d744440df52c98b70cfc8572454d349dd"
        },
        {
          "path": "Boot",
          "type": "TREE",
          "old_hash": "3b2b61ad6407764a1d8a94e98308d952027db73a"
        }
      ]
    }
  }
}
*/
  /* should return an array of items like the following
    [
        {
            name: 'huberfil.sys',
            type: TreeNodeType.Blob,
            diffType: DiffType.DEL
            hash: 'ff6bf70d744440df52c98b70cfc8572454d349dd'
        },
        {
            name: 'Boot',
            type: TreeNodeType.Tree,
            diffType: DiffType.DEL
            hash: '3b2b61ad6407764a1d8a94e98308d952027db73a'
        },
        {
            name: 'pagefile.sys',
            type: TreeNodeType.Blob,
            diffType: DiffType.MOD

        }
    ]
}
*/
  const diffCommitsAt = response.data['diffCommitsAt']
  const newitems = diffCommitsAt.newitems.map((item: any) => ({
    name: item.path,
    type: item.type === 'BLOB' ? TreeNodeType.Blob : TreeNodeType.Tree,
    diffType: DiffType.NEW,
    new_hash: item.new_hash,
    _rowVariant: 'success'
  }))
  const moditems = diffCommitsAt.moditems.map((item: any) => ({
    name: item.path,
    type: item.type === 'BLOB' ? TreeNodeType.Blob : TreeNodeType.Tree,
    diffType: DiffType.MOD,
    old_hash: item.old_hash,
    new_hash: item.new_hash,
    _rowVariant: 'warning'
  }))
  const delitems = diffCommitsAt.delitems.map((item: any) => ({
    name: item.path,
    type: item.type === 'BLOB' ? TreeNodeType.Blob : TreeNodeType.Tree,
    diffType: DiffType.DEL,
    old_hash: item.old_hash,
    _rowVariant: 'danger'
  }))
  return [...newitems, ...moditems, ...delitems]
}

// onMounted, use GET_FS_ROOT to get the root of the filesystem
onMounted(async () => {
  const response = await gqlClient.query({
    query: GET_FS_ROOT,
    variables: { where: { hash_IN: [base_commit.hash, diffee_commit.hash] } }
  })
  // assign fs_root_hash to the corresponding commit
  // data looks like
  response.data['commits'].forEach((commit) => {
    if (commit.hash === base_commit.hash) {
      base_commit.fs_root_hash = commit.filesystemConnection.edges[0].node.hash
    } else if (commit.hash === diffee_commit.hash) {
      diffee_commit.fs_root_hash = commit.filesystemConnection.edges[0].node.hash
    }
  })
})
</script>

<template>
  <div class="container">
    <BCard class="diff-card">
      <div class="diff-header">
        <h2><i class="bi bi-file-earmark-diff"></i> Diff</h2>
      </div>
      <div class="diff-details">
        <h4>
          <span class="commit-name">{{ base_commit.name }}</span>
          <i class="bi bi-arrow-left-right"></i>
          <span class="commit-name">{{ diffee_commit.name }}</span>
        </h4>
      </div>
    </BCard>
    <TreeExplorer :path_dir="at_path" :getEntries="diffFsAt" :fields="fields">
      <template #cell(name)="props">
        <div class="row-container">
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <i class="bi-file-earmark"></i>
              {{ props.data.item.name }}
            </div>
            <div v-else>
              <i class="bi-folder-fill"></i>
              {{ props.data.item.name }}
            </div>
          </div>
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <div v-if="props.data.item.diffType === DiffType.NEW">
                <a
                  :href="getDownloadUrl(props.data.item.new_hash)"
                  :download="`${props.data.item.new_hash}_${props.data.item.name}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else-if="props.data.item.diffType === DiffType.DEL">
                <a
                  :href="getDownloadUrl(props.data.item.old_hash)"
                  :download="`${props.data.item.old_hash}_${props.data.item.name}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else>
                <BDropdown text="Download" variant="primary">
                  <BDropdownItem :href="getDownloadUrl(props.data.item.old_hash)"
                    >Old</BDropdownItem
                  >
                  <BDropdownItem :href="getDownloadUrl(props.data.item.new_hash)"
                    >New</BDropdownItem
                  >
                </BDropdown>
              </div>
            </div>
          </div>
        </div>
      </template>
    </TreeExplorer>
  </div>
</template>

<style scoped>
.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.diff-card {
  padding: 20px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.diff-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.diff-header h2 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
}

.diff-header i {
  margin-right: 10px;
  font-size: 1.5em;
}

.diff-details h4 {
  font-size: 1.25em;
  font-weight: normal;
  display: flex;
  align-items: center;
  margin: 0;
}

.diff-details i {
  margin: 0 10px;
  font-size: 1.25em;
}

.commit-name {
  font-weight: bold;
}
</style>
