<template>
  <div id="app">
    <Navbar />
    <div class="container-fluid">
      <router-view />
    </div>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>

<script>
import Navbar from '@/components/Navbar.vue';

export default {
  components: {
    Navbar
  }
};
</script>

<style scoped>
.container-fluid {
  padding-left: 5%;
  padding-right: 5%;
}
</style>
