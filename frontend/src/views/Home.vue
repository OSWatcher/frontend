<template>
  <div>
    <h2 id="title">
      Operating Systems
    </h2>
    <b-list-group>
      <b-list-group-item
        v-for="os in os_list"
        :key="os"
        :to="{ name: 'OSView', params: { name: os }}"
      >
        {{ os }}
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "Home",
  data() {
    return {
      os_list: []
    };
  },
  methods: {
    get_message() {
      const path = "http://localhost:5000/list_os";
      axios.get(path)
        .then((res) => {
          this.os_list = res.data.os_list;
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
#title {
  padding-bottom: 2rem;
}
</style>
