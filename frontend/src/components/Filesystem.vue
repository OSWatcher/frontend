<template>
  <div>
    <h2>Filesystem</h2>
    <b-breadcrumb :items="fs_path_parts"></b-breadcrumb>
    <b-list-group>
      <b-list-group-item
        v-for="entry in fs_folder_entries"
        :key="entry.name"
        :action="true"
        v-on:click="on_item_clicked"
      >
        <b-icon icon="folder-fill"></b-icon>

        {{ entry.name }}
      </b-list-group-item>
      <b-list-group-item
        v-for="entry in fs_file_entries"
        :key="entry.name"
      >
        <b-icon icon="file-earmark"></b-icon>
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
      fs_folder_entries: [],
      fs_file_entries: []
    };
  },
  methods: {
    get_message() {
      const path = `http://localhost:5000/list_fs_at?os_name=${this.name}&fs_path=${this.fs_path}`;
      axios.get(path)
        .then((res) => {
          this.fs_folder_entries = res.data.fs_entries.filter(entry => this.inode_is_dir(entry.inode_type)).sort(function(a, b) {
            return a.name > b.name;
          });
          this.fs_file_entries = res.data.fs_entries.filter(entry => !this.inode_is_dir(entry.inode_type)).sort(function(a, b) {
            return a.name > b.name;
          });
        })
        .catch((error) => {
          console.error(error);
        });
    },
    inode_is_dir(inode_type) {
      return inode_type == 16384 ? true : false;
    },
    on_item_clicked (event) {
      // check if dir
      console.log(event);
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