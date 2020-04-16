<template>
  <div>
    <template v-if="os.type == 'Linux'">
      <!-- Setuid binaries -->
      <h2>
        Setuid Binaries
        <b-badge variant="secondary">{{ setuid_count }}</b-badge>
      </h2>
      <b-overlay :show=is_loading class="mb-5">
        <b-list-group>
          <b-list-group-item v-for="item in setuid_list" :key="item.path" class="text-monospace">
            {{ item.path }}
          </b-list-group-item>
        </b-list-group>
      </b-overlay>
      <!-- Checksec table -->
      <h2>
        Checksec Binaries
        <b-badge variant="secondary">{{ checksec_count }}</b-badge>
      </h2>
      <b-pagination
        v-model="checksec_current_page"
        :total-rows="checksec_count"
        :per-page="checksec_per_page"
        aria-controls="checksec_table"
      ></b-pagination>
      <b-table
        id="checksec_table"
        striped
        hover
        bordered
        head-variant="dark"
        :items="checksec_items_list"
        :fields="checksec_fields"
        :per-page="checksec_per_page" 
        :current-page="checksec_current_page"
        :busy="is_loading"
        sort-by="path"
      >
        <!-- custom formatting -->
        <!-- relro: full/partial/no -->
        <template v-slot:cell(relro)="data">
          <b-badge v-if="data.value == 'full'" variant="success">
            Full
          </b-badge>
          <b-badge v-else-if="data.value == 'no'" variant="danger">
            No
          </b-badge>
          <b-badge v-else variant="warning">
            Partial
          </b-badge>
        </template>
        <!-- canary true/false -->
        <template v-slot:cell(canary)="data">
          <b-badge v-if="data.value == true" variant="success">
            Yes
          </b-badge>
          <b-badge v-else variant="danger">
            No
          </b-badge>
        </template>
        <!-- nx true/false -->
        <template v-slot:cell(nx)="data">
          <b-badge v-if="data.value == true" variant="success">
            Yes
          </b-badge>
          <b-badge v-else variant="danger">
            No
          </b-badge>
        </template>
        <!-- pie true/false -->
        <template v-slot:cell(pie)="data">
          <b-badge v-if="data.value == 'yes'" variant="success">
            Yes
          </b-badge>
          <b-badge v-else-if="data.value == 'no'" variant="danger">
            No
          </b-badge>
          <b-badge v-else variant="warning">
            {{data.value}}
          </b-badge>
        </template>
        <!-- runpath false/? -->
        <template v-slot:cell(rpath)="data">
          <b-badge v-if="data.value == false" variant="success">
            No
          </b-badge>
          <b-badge v-else variant="danger">
            {{data.value}}
          </b-badge>
        </template>
        <!-- runpath true/false -->
        <template v-slot:cell(runpath)="data">
          <b-badge v-if="data.value == true" variant="danger">
            Yes
          </b-badge>
          <b-badge v-else variant="success">
            No
          </b-badge>
        </template>
        <!-- symbols -->
        <template v-slot:cell(symbols)="data">
          <b-badge v-if="data.value == true" variant="danger">
            Yes
          </b-badge>
          <b-badge v-else variant="success">
            No
          </b-badge>
        </template>
        <!-- fortify_source -->
        <template v-slot:cell(fortify_source)="data">
          <b-badge v-if="data.value == true" variant="success">
            Yes
          </b-badge>
          <b-badge v-else variant="danger">
            No
          </b-badge>
        </template>
        <!-- virtual column fortify_score -->
        <template v-slot:cell(fortify_score)="data">
          <!-- fortify_source and no more functions to be fortified ? OK -->
          <b-badge v-if="data.item.fortify_source && data.item.fortifyable == 0" variant="success">
            100%
          </b-badge>
          <!-- fortify_source disabled and no more functions to be fortified ? BAD -->
          <b-badge v-else-if="!data.item.fortify_source && data.item.fortifyable == 0" variant="danger">
            0%
          </b-badge>
          <b-badge v-else variant="warning">
            {{ Math.round((data.item.fortified *100) / data.item.fortifyable) }}
          </b-badge>
        </template>
      </b-table>
    </template>
  </div>
</template>

<script>
import axios from 'axios';


export default {
  name: 'Security',
  props: {
    os: {
      required: true,
      type: Object
    },
  },
  data() {
    return {
      is_loading: true,
      // linux
      setuid_list: [],
      checksec_items_list: [],
      checksec_fields: [
        {
          key: 'path',
          sortable: true,
          tdClass: 'text-monospace'
        },
        {
          key: 'name',
          sortable: true,
          tdClass: 'text-monospace'
        },
        {
          key: 'relro',
          label: 'Relocation Read-Only',
          sortable: true,
        },
        {
          key: 'canary',
          sortable: true,
        },
        {
          key: 'nx',
          label: 'Non-Executable',
          sortable: true,
        },
        {
          key: 'pie',
          label: 'Position-Independant Executable',
          sortable: true,
        },
        {
          key: 'rpath',
          sortable: true,
        },
        {
          key: 'runpath',
          sortable: true,
        },
        {
          key: 'symbols',
          sortable: true,
        },
        {
          key: 'fortify_source',
          sortable: true,
        },
        {
          key: 'fortify_score',
          sortable: true
        },
      ],
      checksec_per_page: 10,
      checksec_current_page: 1
    };
  },
  methods: {
    list_setuid() {
      const url = `http://localhost:5000/os/${this.os.id}/filesystem/search`;
      const params = {'setuid': true};

      axios.post(url, params)
        .then((res) => {
          this.setuid_list = res.data.result;
        })
        .catch((error) => {
          console.error(error);
        });
    },
    list_checksec() {
      const url = `http://localhost:5000/os/${this.os.id}/filesystem/search`;
      const params = {'checksec': true};

      axios.post(url, params)
        .then((res) => {
          this.checksec_items_list = res.data.result;
        })
        .catch((error) => {
          console.error(error);
        });
    },
  },
  computed: {
    setuid_count () {
      return this.setuid_list.length;
    },
    checksec_count () {
      return this.checksec_items_list.length;
    }
  },
  created() {
    // declare new interceptor on request
    axios.interceptors.request.use(config => {
      // start spinner
      this.is_loading = true;
      return config;
    }, error => {
      // stop spinner
      this.is_loading = false;
      return Promise.reject(error);
    });

    // declare new interceptor on response
    axios.interceptors.response.use(response => {
      // start spinner
      this.is_loading = false;
      return response;
    }, error => {
      // stop spinner
      this.is_loading = false;  
      return Promise.reject(error);
    });
    if (this.os.type == 'Linux') {
      this.list_setuid();
      this.list_checksec();
    }
  }
};
</script>

<style scoped>
.list-group {
  height: 30rem;
  overflow: auto;
}

.table {
  height: 10rem;
  overflow: auto;
}
</style>