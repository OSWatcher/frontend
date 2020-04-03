<template>
  <div>
    <h2>Filesystem</h2>
    <b-breadcrumb>
      <b-breadcrumb-item
        v-for="(entry, index) in fs_path_items"
        :key="entry.id"
        :active="entry.active"
        :disabled="entry.disabled"
        v-on:click="on_breadcrumb_clicked($event, index)"
      >
      {{entry.part}}
      </b-breadcrumb-item>
    </b-breadcrumb>
    <div id="filesystem">
      <!-- Display Filesystem using 2 lists: folders and files, sorted -->
      <b-list-group>
        <b-list-group-item
          v-for="entry in fs_folder_entries"
          :key="entry.id"
          :action="true"
          v-on:click="on_item_clicked"
        >
          <b-icon icon="folder-fill"></b-icon>
          {{entry.name}}
        </b-list-group-item>
        <b-list-group-item
          v-for="entry in fs_file_entries"
          :key="entry.id"
        >
          <b-icon icon="file-earmark"></b-icon>
          {{entry.name}}
        </b-list-group-item>
      </b-list-group>
    </div>
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
      /*
        fs_path_items is the array to be rendered in the breadcrumb
        last item is active and link is disabled
        [
          {
            "part": "Root",
            "active": false,
            "disabled": false,
          },
          ....
          {
            "part": "system32",
            "active": true,
            "disabled": true
          }
        ]
      */
      fs_path_items: this.build_fs_parts("/"),
      fs_folder_entries: [],
      fs_file_entries: []
    };
  },
  methods: {
    list_fs_at(fs_path) {
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
      // update this.fs_path_items
      // replace '/' by 'Root'
      var path_items = [];
      var path_splitted = new_fs_path.split("/");
      // special case for "/"
      // "/".split("/") will return ["", ""]
      // -> remove second empty string
      if (path_splitted[1].length == 0) {
        path_splitted.pop();
      }
      for (var i = 0; i < path_splitted.length; i++) {
        var item = {
          "part": path_splitted[i],
          "active": false,
          "disabled": false
        };
        path_items.push(item);
      }
      // change first item to "Root"
      path_items[0]["part"] = "Root";
      // disable last item
      path_items[path_items.length-1]["active"] = true;
      path_items[path_items.length-1]["disabled"] = true;
      return path_items;
    },
    // events
    on_item_clicked (event) {
      // build new path
      this.fs_path = path.join(this.fs_path, event.target.textContent.trim());
      // fetch fs entries at new location
      this.list_fs_at(this.fs_path);
      // update fs parts for breadcrumb
      this.fs_path_items = this.build_fs_parts(this.fs_path);
    },
    on_breadcrumb_clicked (event, index) {
      // build a new fs_path until index
      // skip 'Root'
      var path_parts = this.fs_path_items.map(item => item.part);
      var new_fs_path_parts = path_parts.slice(1, index + 1);
      var new_fs_path = `/${new_fs_path_parts.join("/")}`;
      this.fs_path = new_fs_path;
      this.list_fs_at(this.fs_path);
      this.fs_path_items = this.build_fs_parts(this.fs_path);
    }
  },
  created() {
    this.list_fs_at(this.fs_path);
  }
};
</script>

<style scoped>
.list-group {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

#filesystem {
  height: 35rem;
  overflow: auto;
}
</style>