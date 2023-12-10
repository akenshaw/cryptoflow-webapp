<script>
import SymbolForm from './components/SymbolForm.vue'
import BubbleChart from './components/BubbleChart.vue'

export default {
  name: 'App',
  components: {
    SymbolForm,
    BubbleChart,  
  },
  data() {
    return {
      rawData: {},
      showBubbleChart: false,
      isBubbleChartFullScreen: false,
      auto_scale: true,
      tickerPrice: null,
    };
  },

  methods: {
    toggle_autoScale() {
      this.auto_scale = !this.auto_scale;
      console.log('Auto Scale: ' + this.auto_scale);
    },
    handleFullscreenChange(isFullScreen) {
      this.isBubbleChartFullScreen = isFullScreen;
    },
  },

  mounted() {
    this.worker = new Worker('src/worker.js');

    this.worker.onmessage = (event) => {
      if (event.data.type === 'u') {
        this.rawData = event.data;
        if (!this.isBubbleChartFullScreen) { 
          this.tickerPrice = parseFloat(event.data.depth.bids[0][0]); 
        }
        
      } else if (event.data.type === 1) {
        console.log('WebSocket connection opened');      
        this.showBubbleChart = true;          

      } else if (event.data.type === 0) {
        console.log('Closing previous websocket connection...');

        this.rawData = {};
        this.$nextTick(() => {
          this.showBubbleChart = false;
        });
      }
    };
  },
  
  beforeUnmount() {
    //
  },
}
</script>

<template>
  <body>
    <header> 
      <SymbolForm v-show="!isBubbleChartFullScreen" :tickerPrice="tickerPrice" />
    </header>
    <!--<button @click="toggle_autoScale()">Toggle Auto Scale</button>-->
    <div id="charts_flex" class="flex-container">
      <bubble-chart v-if="showBubbleChart" ref="bubbleChart" :rawData="rawData" @fullscreen-change="handleFullscreenChange"/>
    </div>
  </body>
</template>

<style scoped>
  * {
    box-sizing: border-box;
    /*outline: 1px solid rgba(255, 0, 0, 0.25);*/
  }
  html {
    height: 100%;
  }

  header {
    position: sticky;
    padding: 1.5vh;
    font-family: 'Fira Mono', monospace;
    border-top: 0.2vh solid #4d4d4d;
    width: 100%; 
    z-index: 1;
  }

  #charts_flex {
    display: flex;
    justify-content: center;
  }
  .sub-flex-container {
    display: flex;
    flex-direction: column;
  }

  body {
    margin-top: 2vh;
  }

  #annenLoading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%; 
    z-index: 1;
  }
</style>
