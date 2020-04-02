<template>
  <div>
    <h2 id="title">
      {{name}}
    </h2>
  </div>
</template>

<script>
export default {
  name: "OSView",
  props: {
    name: {
      required: true,
      type: String
    }
  }
};
</script>