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
  }
};
</script>

<style scoped>
#title {
  padding-bottom: 2rem;
}
</style>