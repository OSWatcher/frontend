<template>
  <div>
    <h2 id="title">
      Operating Systems
    </h2>
    <b-list-group>
      <b-list-group-item
        v-for="os in os_items"
        :key="os['id']"
        :to="{ name: 'OSView', params: { id: os['id'] }}"
      >
        {{ os['name'] }}
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
      os_items: []
    };
  },
  methods: {
    get_message() {
      const url = "http://localhost:5000/os";
      axios.get(url)
        .then((res) => {
          this.os_items = res.data.os;
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
