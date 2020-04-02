<template>
  <div>
    <h2>Filesystem</h2>
    <b-breadcrumb :items="fs_path_parts"></b-breadcrumb>
    <b-list-group>
      <b-list-group-item
        v-for="entry in fs_entries"
        :key="entry.name"
      >
        
        <b-icon v-if="entry.inode_type == 16384" icon="folder-fill"></b-icon>
        <b-icon v-else icon="file-earmark"></b-icon>
        {{ entry.name }}
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "Filesystem",
  props: {
    name: {
      required: true,
      type: String
    },
  },
  data() {
    return {
      fs_path: "/",
      fs_path_parts: ["Root"],
      fs_entries: []
    };
  },
  methods: {
    get_message() {
      const path = `http://localhost:5000/list_fs_at?os_name=${this.name}&fs_path=${this.fs_entries}`;
      axios.get(path)
        .then((res) => {
          this.fs_entries = res.data.fs_entries;
        })
        .catch((error) => {
          console.error(error);
        });
    }
  },
  created() {
    this.get_message();
  }
};
</script>

<style scoped>
.list-group {
  padding-top: 1rem;
  padding-bottom: 1rem;
}
</style>