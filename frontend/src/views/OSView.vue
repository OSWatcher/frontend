<template>
  <div>
    <h2 id="title">
      {{name}}
    </h2>
    <Filesystem :os_id="id"/>
    <SyscallTable :os_id="id"/>
  </div>
</template>

<script>
import axios from "axios";
import Filesystem from "@/components/Filesystem.vue";
import SyscallTable from "@/components/SyscallTable.vue";

export default {
  name: "OSView",
  components: {
    Filesystem,
    SyscallTable
  },
  props: {
    id: {
      required: true,
      type: String
    }
  },
  data () {
    return {
      os_item: {}
    };
  },
  created () {
    // query OS details from OS ID to get the OS type
    const url = `http://localhost:5000/os/${this.id}`;

    axios.get(url)
      .then((res) => {
        this.os_item = res.data.os;
      })
      .catch((error) => {
        console.error(error);
      });
    console.log(this.os_item);
  }
  
};
</script>

<style scoped>
#title {
  padding-bottom: 2rem;
}
</style>