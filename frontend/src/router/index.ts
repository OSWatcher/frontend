import Vue from "vue";
import VueRouter from "vue-router";
import Home from "@/views/Home.vue";
import OSView from "@/views/OSView.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home
  },
  {
    path: "/os_view/:name",
    name: "OSView",
    component: OSView,
    props: true
  }
];

const router = new VueRouter({
  mode: "history",
  base: process.env.BASE_URL,
  routes
});

export default router;
