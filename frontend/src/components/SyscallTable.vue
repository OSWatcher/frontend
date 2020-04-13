<template>
  <div>
    <h2>Syscall Table</h2>
    <div class="overflow-auto">
      <b-pagination
        v-model="current_page"
        :total-rows="rows"
        :per-page="per_page"
        aria-controls="syscall_table"
      ></b-pagination>
      <b-table
        id="syscall_table"
        striped
        hover
        bordered
        :items="items"
        :fields="fields"
        :per-page="per_page" 
        :current-page="current_page"
        :busy="is_loading"
        sort-by="index"
      >
        <template v-slot:table-busy>
          <div class="text-center text-info my-2">
            <b-spinner class="align-middle"></b-spinner>
            <strong>Loading...</strong>
          </div>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import axios from "axios";


export default {
  name: "SyscallTable",
  props: {
    os: {
      required: true,
      type: Object
    },
  },
  data() {
    return {
      is_loading: true,
      fields: [
        {
          key: "index",
          sortable: true
        },
        {
          key: "address",
        },
        {
          key: "name",
          sortable: true
        }
      ],
      items: {},
      per_page: 20,
      current_page: 1
    };
  },
  computed: {
    rows() {
      return this.items.length;
    }
  },
  methods: {
    list_syscalls() {
      const url = `http://localhost:5000/os/${this.os.id}/syscall`;

      axios.get(url)
        .then((res) => {
          this.items = res.data.syscall_entries;
        })
        .catch((error) => {
          console.error(error);
        });
    },
  },
  created() {
    // declare new interceptor on request
    axios.interceptors.request.use(config => {
      // start spinner
      this.is_loading = true;
      return config;
    }, error => {
      // stop spinner
      this.is_loading = false;
      return Promise.reject(error);
    });

    // declare new interceptor on response
    axios.interceptors.response.use(response => {
      // start spinner
      this.is_loading = false;
      return response;
    }, error => {
      // stop spinner
      this.is_loading = false;  
      return Promise.reject(error);
    });

    this.list_syscalls();
  }
};
</script>

<style scoped>
h2 {
  margin-top: 3rem;
}

</style>