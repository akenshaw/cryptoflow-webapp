<script>
import SymbolForm from './components/SymbolForm.vue'
import BubbleChart from './components/BubbleChart.vue'
import MyWorker from './worker?worker';

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
      isFirstMessage: true,
      annenLoading: false,
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
    this.worker = new MyWorker();
    
    this.worker.onmessage = (event) => {
      if (event.data.type === 'u') {
        if (this.isFirstMessage) {
          this.$nextTick(() => { this.annenLoading = false; this.showBubbleChart = true });
          this.isFirstMessage = false;
        };
        this.rawData = event.data;
        if (!this.isBubbleChartFullScreen) { 
          this.tickerPrice = parseFloat(event.data.depth.bids[0][0]) 
        };
        
      } else if (event.data.type === 1) {
        console.log('WebSocket connection opened'); 
        this.$nextTick(() => { this.annenLoading = true });
        this.isFirstMessage = true;  

      } else if (event.data.type === 0) {
        console.log('Closing previous websocket connection...');
        this.$nextTick(() => { this.showBubbleChart = false; this.annenLoading = true });
        this.rawData = {};
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
    <div id="charts_flex" class="flex-container">
      <bubble-chart v-if="showBubbleChart" ref="bubbleChart" :rawData="rawData" @fullscreen-change="handleFullscreenChange"/>
      <div class="bars-4" v-show="annenLoading"></div>
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
  body {
    margin-top: 2vh;
  }

  header {
    position: sticky;
    padding: 1.5vh;
    font-family: 'Fira Mono', monospace;
    border-top: 0.2vh solid #4d4d4d;
    width: 100%; 
    z-index: 4;
  }

  #charts_flex {
    display: flex;
    justify-content: center;
    z-index: 1;
  }
  .sub-flex-container {
    display: flex;
    flex-direction: column;
  }
  .bars-4 {
    position: absolute;
    top: 47vh;
    width: 45px;
    aspect-ratio: 1;
    --c: no-repeat linear-gradient(#c0c0c0 calc(50% - 10px),#0000 0 calc(50% + 10px),#c0c0c0 0);
    background: 
      var(--c) 0%   100%,
      var(--c) 50%  100%,
      var(--c) 100% 100%;
    background-size: 20% calc(200% + 20px);
    animation:b4 1s infinite linear;
  }
  @keyframes b4 {
      33%  {background-position: 0% 50%,50% 100%,100% 100%}
      50%  {background-position: 0%  0%,50%  50%,100% 100%}
      66%  {background-position: 0%  0%,50%   0%,100%  50%}
      100% {background-position: 0%  0%,50%   0%,100%   0%}
  }
</style>
