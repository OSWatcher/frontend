<template>
  <div>
    <template v-if="os_item != null">
      <h2 id="title">
        {{os_item.name}}
      </h2>
      <b-card no-body>
        <b-tabs card>
          <b-tab title="Filesystem" active>
            <Filesystem :os="os_item"/>
          </b-tab>
          <!-- syscall table can only be extracted with Volatility for Windows -->
          <template v-if="os_item.type == 'Windows'">
            <b-tab title="Syscalls">
              <SyscallTable :os="os_item"/>
            </b-tab>
          </template>
          <b-tab title="Security" v-if="os_item.type == 'Linux'">
            <Security :os="os_item"/>
          </b-tab>
        </b-tabs>
      </b-card>
    </template>
  </div>
</template>

<script>
import axios from 'axios';
import Filesystem from '@/components/Filesystem.vue';
import SyscallTable from '@/components/SyscallTable.vue';
import Security from '@/components/Security.vue';
import config from '@/config.ts';

export default {
  name: 'OSView',
  components: {
    Filesystem,
    SyscallTable,
    Security
  },
  props: {
    id: {
      required: true,
      type: String
    }
  },
  data () {
    return {
      os_item: null
    };
  },
  created () {
    // query OS details from OS ID to get the OS type
    const url = `${config.API_LOCATION}/os/${this.id}`;

    axios.get(url)
      .then((res) => {
        this.os_item = res.data.os;
      })
      .catch((error) => {
        console.error(error);
      });
  }
};
</script>

<style scoped>
#title {
  padding-bottom: 2rem;
}
</style>