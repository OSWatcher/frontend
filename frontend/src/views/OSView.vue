<template>
  <div>
    <h2 id="title">
      {{name}}
    </h2>
    <Filesystem :name="name"/>
  </div>
</template>

<script>
import Filesystem from "@/components/Filesystem.vue";

export default {
  name: "OSView",
  components: {
    Filesystem
  },
  props: {
    name: {
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