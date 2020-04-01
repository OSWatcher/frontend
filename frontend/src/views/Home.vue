<template>
  <div>
    <h2 id="title">Operating Systems</h2>
    <b-list-group>
      <b-list-group-item to="/" v-for="os in osList" :key="os">
        {{ os }}
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
export default {
  name: "Home",
  data () {
    return {
      osList: [
        "Windows XP",
        "Windows Vista",
        "Windows 7",
        "Windows 8",
        "Windows 10"
      ]
    };
  }
};
</script>

<style scoped>
#title {
  padding-bottom: 2rem;
}
</style>
