<script setup>
  import { watch, computed, ref, shallowRef, reactive, shallowReactive, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
  import { useThresholdsStore } from '../stores/thresholds.js'

  import { library } from '@fortawesome/fontawesome-svg-core'
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  import { faDownLeftAndUpRightToCenter, faLock, faLockOpen, faTrash, faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons'
  library.add(faUpRightAndDownLeftFromCenter, faDownLeftAndUpRightToCenter, faLock, faLockOpen, faTrash)

  import { Line, Bubble, Bar, Scatter } from 'vue-chartjs'
  import { Chart as ChartJS, Title, Tooltip, Legend, PointElement, LineElement, LinearScale, TimeSeriesScale, BarElement, CategoryScale} from 'chart.js/auto'
  import 'chartjs-adapter-luxon';
  import zoomPlugin from 'chartjs-plugin-zoom';

  ChartJS.register(Title, Tooltip, Legend, PointElement, LineElement, LinearScale, TimeSeriesScale, BarElement, CategoryScale, zoomPlugin);

  const bubbleChart = shallowRef(null);

  const thresholdsStore = useThresholdsStore();

  const props = defineProps({
    rawData: {
      type: Object,
      required: true,
    },
  });

  let processedData = [];
  const chartData = computed(() => {
    if (Object.keys(props.rawData).length === 0) { return defaultData } 
    else {
      processedData = processData(props.rawData);

      // Remove data points older than 1 minute
      let currentTime = new Date();
      let filterDataPoints = function(dataset) {
        return dataset.data.filter(function(dataPoint) {
          return currentTime - dataPoint.x < 60000;
        });
      };
      [defaultData].forEach((chart) => {
        chart.datasets.forEach((dataset, index) => {
          if (index !== 6 && index !== 7 && index !== 8 && index !== 9) {
            chart.datasets[index].data = filterDataPoints(dataset);
          }
        });
      });
      tradesArray = tradesArray.filter((trade) => currentTime - trade.x < 60000);

      // Update the chart data
      return {
        labels: [],
        datasets: processedData.map((newData, index) => {
          if (index === 8 || index === 9) {
            defaultData.datasets[index].data = newData;
          } else {
            defaultData.datasets[index].data = Array.isArray(newData)
              ? (index === 0 || index === 1 ? [...defaultData.datasets[index].data, ...newData] : [...newData])
              : [...defaultData.datasets[index].data, newData];
          }
          return { ...defaultData.datasets[index] };
        }),
      };
    }
  });
  const chartOptions = computed(() => {
    let options = { ...defaultOptions };
    let depth_scales_x_max;

    if (Object.keys(props.rawData).length !== 0) {      
      const minTradePrice = Math.min.apply(Math, tradesArray.map((item) => parseFloat(item.y)));
      const maxTradePrice = Math.max.apply(Math, tradesArray.map((item) => parseFloat(item.y)));

      const rangelowBid = Math.min(processedData[7][40].y, minTradePrice);
      const rangehighAsk = Math.max(processedData[6][processedData[6].length-41].y, maxTradePrice);

      const filteredBidsData = processedData[7].filter((item) => parseFloat(item.y) >= rangelowBid);
      const filteredAsksData = processedData[6].filter((item) => parseFloat(item.y) <= rangehighAsk);

      const maxDQuantity = Math.max(
        Math.max.apply(Math, filteredBidsData.map((item) => parseFloat(item.x))),
        Math.max.apply(Math, filteredAsksData.map((item) => parseFloat(item.x)))
      );

      if (rangelowBid === 0) {
        console.error("rangelowBid cannot be zero");
      } else {
        const notional_threshold = 1200000 / rangelowBid;
        const scales = [notional_threshold/10, notional_threshold/4, notional_threshold/2, notional_threshold, notional_threshold*2];
        const maxScale = scales[scales.length - 1];
      
        for (let i = 0; i < scales.length; i++) {
          if (maxDQuantity <= scales[i]) {
            depth_scales_x_max = scales[i];
            break;
          } else if (i == scales.length - 1 && maxDQuantity > maxScale) {
            depth_scales_x_max = maxDQuantity * 1.1;
          }
        }
      }

      const maxAbsTradeCount = Math.max(
        Math.min.apply(Math, defaultData.datasets[9].data.map((item) => parseFloat(item.y))),
        Math.max.apply(Math, defaultData.datasets[8].data.map((item) => parseFloat(item.y))),
      );
      if (isLocked) {
        options.scales.y.min = rangelowBid;
        options.scales.y.max = rangehighAsk;
      };

      options.scales.xAxes2.max = Math.max.apply(Math, tradesArray.map((item) => parseFloat(item.r)));
      options.scales.yAxes1.min = -maxAbsTradeCount;
      options.scales.yAxes1.max = maxAbsTradeCount;

      options.scales.xAxes0.max = depth_scales_x_max;
    }
    return options;
  });

  const defaultData = shallowReactive({
    labels: [],
    datasets: [
      { 
        indexAxis: 'x',
        type: 'bubble',
        label: "Red Bubbles",
        data: [], 
        backgroundColor: "#C0504E",
        yAxisID: 'y', 
        xAxisID: 'x',
      },
      { 
        indexAxis: 'x',
        type: 'bubble',
        label: "Green Bubbles",
        data: [], 
        backgroundColor: "#51CDA0",
        yAxisID: 'y',
        xAxisID: 'x',
      },
      {
        indexAxis: 'x',
        type: 'line',
        label: "Best Bid",
        data: [],
        borderColor: 'rgba(0, 128, 0, 0.5)',
        fill: false,
        pointRadius: 0, 
        yAxisID: 'y', 
        xAxisID: 'x',
      },
      {
        indexAxis: 'x',
        type: 'line',
        label: "Best Ask",
        data: [], 
        borderColor: 'rgba(255, 0, 0, 0.5)',
        fill: false,
        pointRadius: 0, 
        yAxisID: 'y', 
        xAxisID: 'x',
      },
      {
        indexAxis: 'x',
        type: 'bar',
        label: "Buys",
        data: [],
        backgroundColor: '#51CDA0',
        yAxisID: 'yAxes0',
        xAxisID: 'x',
      },
      { 
        indexAxis: 'x',
        type: 'bar',
        label: "Sells",
        data: [],
        backgroundColor: '#C0504E',
        yAxisID: 'yAxes0',
        xAxisID: 'x',
      },      
      {
        indexAxis: 'yAxes0',
        type: 'bar',
        barPercentage: 1,
        categoryPercentage: 1,
        label: "Asks",
        data: [],
        backgroundColor: '#C0504E',
        xAxisID: 'xAxes0',
        yAxisID: 'y',
      },
      { 
        indexAxis: 'yAxes0',
        type: 'bar',
        label: "Bids",
        barPercentage: 1,
        categoryPercentage: 1,
        data: [],
        backgroundColor: '#51CDA0',
        xAxisID: 'xAxes0',
        yAxisID: 'y',
      },
      {
        type: 'scatter',
        label: 'Buy Trades',
        data: [],
        backgroundColor: '#51CDA0',
        xAxisID: 'xAxes2',
        yAxisID: 'yAxes1',
      }, 
      { 
        type: 'scatter',
        label: 'Sell Trades',
        data: [],
        backgroundColor: '#C0504E',
        xAxisID: 'xAxes2',
        yAxisID: 'yAxes1',
      },
    ]
  });
  const defaultOptions = shallowReactive({
    parsing: false,
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    spanGaps: true,
    plugins: {
      tooltip: {
        filter: function (tooltipItem) {
            return ![2, 3].includes(tooltipItem.datasetIndex);
          },
        callbacks: {
          label: function(context) {
            let dataset = context.chart.data.datasets[context.datasetIndex];
            let index = context.dataIndex;

            if (dataset.label === "Red Bubbles" || dataset.label === "Green Bubbles") {
              return 'Size: ' + dataset.data[index].originalRadius;
            };
          },
        }
      },
      legend: {
        display: false,
      },
      zoom: {
        pan: {
          enabled: false,
          mode: 'y',
          scaleMode: 'y', 
          threshold: 10,
        },
        zoom: {
          wheel: {
            enabled: true     
          },
          mode: 'y',
          scaleMode: 'y',            
        },
      },
    },
    scales: {
      x: {
        type: 'timeseries',
        time: {
          unit: 'millisecond',
          parser: 'ss.SSS',
          displayFormats: {
            millisecond: 'ss.SSS'
          },
        },
        stack: 'stack_x',
        stackWeight: 4, 
        grid: { display: false },
        ticks: { maxTicksLimit: 10, maxRotation: 0, mirror: false },
        offset: false,
        position: 'bottom',
      },
      xAxes0: {
        //depth 
        type: 'linear',
        stack: 'stack_x2',
        stackWeight: 1, 
        min: 0,
        grid: { display: false },
        ticks: { mirror: false },
        offset: true,
        position: 'top',
      },
      xAxes1: {
        //stack helper 
        type: 'linear',
        stack: 'stack_x2',
        stackWeight: 4, 
        grid: { display: false },
        ticks: {
          display: true,
          mirror: false,
          maxTicksLimit: 1,
          callback: function(value, index, values) {
            return value !== 0 ? value : '';
          },
        },
        offset: false,
        position: 'top',
      },
      xAxes2: {
        // trade quantity 
        type: 'linear',
        stack: 'stack_x',
        stackWeight: 1, 
        min: 0,
        grid: { display: false },
        ticks: { mirror: false, maxRotation: 0 },
        offset: true,
        position: 'bottom',
      },
      y: {
        //price 
        type: 'linear',
        stack: 'stack_y',
        stackWeight: 4,
        offset: true,
        grid: { display: false },
        ticks: {
          mirror: true,
          includeBounds: true,
          maxTicksLimit: 4,
          maxRotation: 0,
          font: {
            size: 14,
          },
        },
        position: 'right',
      },
      yAxes0: {
        //volume 
        type: 'linear',
        stack: 'stack_y1',
        stackWeight: 1, 
        offset: true,
        grid: { display: false },
        ticks: { display: true, mirror: false },
        position: 'left',
      },
      yAxes1: {
        //trade count 
        type: 'linear',
        stack: 'stack_y',
        stackWeight: 1,
        offset: true,
        grid: { display: false },
        ticks: { maxTicksLimit: 3, mirror: true },
        position: 'right',
      },
      yAxes2: {
        //stack helper 
        type: 'linear',
        stack: 'stack_y1',
        stackWeight: 4,
        offset: false,
        grid: { display: false },
        ticks: {
          maxTicksLimit: 1,
          display: true,
          mirror: true,
          callback: function(value, index, values) {
            return value !== 0 ? value : '';
          },
        },
        position: 'left',
      },
    },
  });

  let tradesArray = [];
  const processData = (rawData) => {
    const depthData = rawData.depth;
    const update_time = rawData.update_time;

    const asksData = [];
    [...depthData.asks].reverse().forEach((item) => { asksData.push({ x: parseFloat(item[1]), y: item[0] })
    });
    const bidsData = [];
    depthData.bids.forEach((item) => { bidsData.push({ x: parseFloat(item[1]), y: item[0] }) 
    });

    const bestBidPointData = { x: update_time, y: parseFloat(depthData.bids[0][0]) };
    const bestAskPointData = { x: update_time, y: parseFloat(depthData.asks[0][0]) };

    let aggTradeBuffer = rawData.tradesBuffer;
    tradesArray.push(...aggTradeBuffer);

    const scaledAggTradeBuffer = aggTradeBuffer.map(obj => {
      const newObj = {...obj}; 
      newObj.originalRadius = newObj.r;
      newObj.r = scale_size_fixed(newObj.y, newObj.r);
      return newObj;
    });

    const sellBubblesBuffer = [];
    const buyBubblesBuffer = [];
    scaledAggTradeBuffer.forEach(point => {
      if (point.r !== 0) {
        const mappedPoint = {x: update_time, y: point.y, _custom: point.r, originalRadius: point.originalRadius};
        if (point.m) {
          sellBubblesBuffer.push(mappedPoint);
        } else {
          buyBubblesBuffer.push(mappedPoint);
        }
      }
    });

    const sums = aggTradeBuffer.reduce(function(acc, pointData) {
      acc[pointData.m ? 'sell' : 'buy'] += pointData.r;
      return acc;
    }, {sell: 0, buy: 0});          
    const volumePointDataSell = { x: update_time, y: parseFloat(-sums.sell) };
    const volumePointDataBuy = { x: update_time, y: parseFloat(sums.buy) };

    const tradeCounts = tradesArray.reduce((counts, trade) => {
      const quantity = trade.r;
      if (!counts[quantity]) {
        counts[quantity] = { buy: 0, sell: 0 };
      }
      if (trade.m) {
        counts[quantity].sell++;
      } else {
        counts[quantity].buy++;
      }
      return counts;
    }, {});
    
    const tradeCountsBuy = Object.entries(tradeCounts).filter(([quantity, counts]) => counts.buy > 0).map(([quantity, counts]) => ({x: parseFloat(quantity), y: counts.buy}));
    const tradeCountsSell = Object.entries(tradeCounts).filter(([quantity, counts]) => counts.sell > 0).map(([quantity, counts]) => ({x: parseFloat(quantity), y: -counts.sell}));

    const processedData = [
      sellBubblesBuffer,
      buyBubblesBuffer,
      bestBidPointData,
      bestAskPointData,
      volumePointDataBuy,
      volumePointDataSell,
      asksData,
      bidsData, 
      tradeCountsBuy,
      tradeCountsSell
    ];
    return processedData;
  };
  
  const clear_all_data = () => {
    console.log('Clearing all data...');

    defaultData.datasets.forEach((dataset, index) => {
      defaultData.datasets[index].data = [];
    });

    tradesArray = [];
    processedData = [];
  };

  let sizes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const scale_size_fixed = (price, quantity) => {
    let quoteQty = price * quantity;
    let index = binarySearch(thresholdsStore.$state.thresholds, quoteQty);
    return sizes[index];
  };
  const binarySearch = (arr, x) => {
    let start = 0, end = arr.length - 1;

    while (start <= end) {
        let mid = Math.floor((start + end) / 2);

        if (arr[mid] === x) return mid;
        else if (arr[mid] < x) start = mid + 1;
        else end = mid - 1;
    }
    return start;
  };
  
  let isLocked = true;
  let currentScaleIcon = 'fa-solid fa-lock';
  const toggleAutoScale = () => {
    isLocked = !isLocked;
    currentScaleIcon = isLocked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
    console.log('Auto Scale: ' + isLocked);
  };

  const emit = defineEmits(['fullscreen-change']);
  const isFullScreen = ref(false);

  let currentArrowIcon = 'fa-solid fa-up-right-and-down-left-from-center';
  let chartWidth = '80vw';
  let chartHeight = '80vh';
  const toggleFullScreen = () => {
    isFullScreen.value = !isFullScreen.value;
    emit('fullscreen-change', isFullScreen.value);

    currentArrowIcon = isFullScreen.value ? 'fa-solid fa-down-left-and-up-right-to-center' : 'fa-solid fa-up-right-and-down-left-from-center';
    if (isFullScreen.value) {
      chartWidth = '95vw';
      chartHeight = '90vh';
    } else {
      chartWidth = '80vw';
      chartHeight = '80vh';
    }
  };

  onMounted(() => {
    clear_all_data();
    console.log('BubbleChart mounted');
  });
  onBeforeUnmount(() => {
    console.log('Unmounting BubbleChart...');
    clear_all_data();
  });
  onUnmounted(() => {
    console.log('BubbleChart unmounted');
  });
</script>

<template>
  <div class="bubble-chart" :style="{ width: chartWidth, height: chartHeight }">

    <div class="chart-controls">
      <button @click="toggleFullScreen()"> 
        <font-awesome-icon :icon="currentArrowIcon" rotation=90 style="color: #4d4d4d"/> 
      </button>
      <button @click="toggleAutoScale()">
        <font-awesome-icon :icon="currentScaleIcon" style="color: #4d4d4d"/> 
      </button>   
      <button @click="clear_all_data()">
        <font-awesome-icon icon="fa-solid fa-trash" style="color: #4d4d4d"/>
      </button>
    </div>

    <Line ref="bubbleChart" :data="chartData" :options="chartOptions" :rawData="rawData" />
  </div>
</template>
  
<style scoped>
.bubble-chart {
  position: relative; 
  width: 80vw; 
  height: 80vh; 
  box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.2);
}
.chart-controls {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  height: auto; 
  display: flex;
  flex-direction: row;
}
.chart-controls button {
  margin: 5px;
  width: 30px;
  height: 30px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  border-radius: 4px;
}
.chart-controls button:hover {
  background-color: rgb(130, 130, 130); 
}
</style>

