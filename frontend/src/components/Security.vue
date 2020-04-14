<template>
  <div>
    <!-- Setuid binaries (if Linux) -->
    <template v-if="os.type == 'Linux'">
      <h2>Setuid Binaries</h2>
      <b-overlay :show=is_loading>
        <b-list-group>
          <b-list-group-item v-for="item in setuid_list" :key="item.path" class="text-monospace">
            {{ item.path }}
          </b-list-group-item>
        </b-list-group>
      </b-overlay>
    </template>
  </div>
</template>

<script>
import axios from "axios";


export default {
  name: "Security",
  props: {
    os: {
      required: true,
      type: Object
    },
  },
  data() {
    return {
      is_loading: true,
      setuid_list: []
    };
  },
  methods: {
    list_setuid() {
      const url = `http://localhost:5000/os/${this.os.id}/filesystem/search`;
      const params = {"setuid": true};

      axios.post(url, params)
        .then((res) => {
          this.setuid_list = res.data.result;
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
    this.list_setuid();
  }
};
</script>

<style scoped>
.list-group {
  height: 30rem;
  overflow: auto;
}
</style>