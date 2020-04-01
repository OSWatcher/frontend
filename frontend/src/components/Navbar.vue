<template>
  <b-navbar type="dark">
    <b-navbar-brand href="#">
      <img src="@/assets/logo.png" alt="logo" />
    </b-navbar-brand>
    <b-navbar-nav>
      <b-nav-item to="/" active-class="active">Home</b-nav-item>
    </b-navbar-nav>
  </b-navbar>
</template>

<style scoped>
.navbar {
  padding: 0;
  padding-left: 1rem;
  padding-right: 1rem;
  margin-bottom: 2rem;
  height: 4rem;
  background-color: #3b4a6b;
}

.navbar-brand {
  padding: 0;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.navbar-brand img {
  width: 13.3rem;
}
</style>
