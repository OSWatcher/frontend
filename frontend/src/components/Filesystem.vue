<template>
  <div>
    <h2>Filesystem</h2>
    <b-breadcrumb>
      <b-breadcrumb-item
        v-for="(entry, index) in fs_path_parts"
        :key="entry.part"
        :active="entry.active"
        :disabled="entry.disabled"
        v-on:click="on_breadcrumb_clicked($event, index)"
      >
      {{entry.part}}
      </b-breadcrumb-item>
    </b-breadcrumb>
    <b-list-group>
      <b-list-group-item
        v-for="entry in fs_folder_entries"
        :key="entry.name"
        :action="true"
        v-on:click="on_item_clicked"
      >
        <b-icon icon="folder-fill"></b-icon>

        {{entry.name}}
      </b-list-group-item>
      <b-list-group-item
        v-for="entry in fs_file_entries"
        :key="entry.name"
      >
        <b-icon icon="file-earmark"></b-icon>
        {{entry.name}}
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";
const path = require("path");


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
      fs_path_parts: this.build_fs_parts("/"),
      fs_folder_entries: [],
      fs_file_entries: []
    };
  },
  methods: {
    get_message(fs_path) {
      const path = `http://localhost:5000/list_fs_at?os_name=${this.name}&fs_path=${fs_path}`;
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
    build_fs_parts(new_fs_path) {
      // update this.fs_path_parts
      // replace '/' by 'Root'
      var parts = [];
      var splitted = new_fs_path.split("/");
      // special case for "/"
      // "/".split("/") will return ["", ""]
      // -> remove second empty string
      if (splitted[1].length == 0) {
        splitted.pop();
      }
      for (var i = 0; i < splitted.length; i++) {
        var item = {
          "part": splitted[i],
          "active": false,
          "disabled": false
        };
        parts.push(item);
        console.log(item);
        console.log(parts);
      }
      // change first item to "Root"
      parts[0]["part"] = "Root";
      // disable last item
      parts[parts.length-1]["active"] = true;
      parts[parts.length-1]["disabled"] = true;
      return parts;
    },
    // events
    on_item_clicked (event) {
      // build new path
      this.fs_path = path.join(this.fs_path, event.target.textContent.trim());
      // fetch fs entries at new location
      this.get_message(this.fs_path);
      // update fs parts for breadcrumb
      this.fs_path_parts = this.build_fs_parts(this.fs_path);
    },
    on_breadcrumb_clicked (event, index) {
      // build a new fs_path until index
      // skip 'Root'
      var new_fs_path_parts = this.fs_path_parts.slice(1, index + 1);
      var new_fs_path = `/${new_fs_path_parts.join("/")}`;
      this.fs_path = new_fs_path;
      this.get_message(this.fs_path);
      this.fs_path_parts = this.build_fs_parts(this.fs_path);
    }
  },
  created() {
    this.get_message(this.fs_path);
  }
};
</script>

<style scoped>
.list-group {
  padding-top: 1rem;
  padding-bottom: 1rem;
}
</style>