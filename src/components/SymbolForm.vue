<script>
  import { useThresholdsStore } from '../stores/thresholds.js'

  import { library } from '@fortawesome/fontawesome-svg-core'
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  import { faList, faHome } from '@fortawesome/free-solid-svg-icons'
  library.add(faList, faHome)

  export default {
    components : {
      FontAwesomeIcon
    },
    data() {
      return {
        thresholdsStore: useThresholdsStore(),
        tickerStyle: {},
        dropdownDisabled: false,
        fetchButtonDisabled: false,
        terminateButtonDisabled: false,
        toggleSlider: false,
        symbolName: null,
        fundingRate: null,
        openInterestValue: null,
        openInterestQty: null,
        price24hr: null,
        volume24hr: null,
        openInterest24hr: null,
        combined_dict: {},
        historicalOpenInterest: [],
        index: 0,
        asc: true,
        loader: false,
        showTable: false,
        searchTerm: '',
        currentSymbol: null,
      }
    },
    
    props: {
      tickerPrice: {
        type: Number,
        default: null
      },
    },

    watch: {
      tickerPrice(newVal, oldVal) {
        if (newVal > oldVal) {
          this.tickerStyle = {
            color: '#51CDA0',
            transition: 'color 0.25s ease-in-out'
          };
        } else if (newVal < oldVal) {
          this.tickerStyle = {
            color: '#C0504E',
            transition: 'color 0.25s ease-in-out'
          };
        }
        setTimeout(() => {
          this.tickerStyle.color = 'rgba(200, 200, 200)';
        }, 350);
      },
    },
    computed: {
      filteredItems() {
        if (this.searchTerm === '') {
          return this.combined_dict;
        } else {
          let filtered = {};
          for (let key in this.combined_dict) {
            if (key.toLowerCase().includes(this.searchTerm.toLowerCase())) {
              filtered[key] = this.combined_dict[key];
            }
          }
          return filtered;
        }
      },
      localMinThreshold: {
        get() {
          console.log('Getting min threshold: ' + this.thresholdsStore.$state.minThreshold);
          return this.thresholdsStore.$state.minThreshold;
        },
        set(value) {
          this.thresholdsStore.setMinThreshold(value);
        }
      },
    },
    methods: {  
      async toggleDropdown() {
        if (!this.showTable) {
          this.dropdownDisabled = true;
          this.loader = true;
          await this.$nextTick();
          await this.fetchSymbols();
          this.showTable = true;
          this.$refs.symbolInput.focus(); 
        } else {
          this.showTable = false;
          return;
        }
        this.loader = false;
        this.dropdownDisabled = false;
      },

      handleInput() {
        if (!this.showTable) {
          this.showTable = true;
        }
        if (Object.keys(this.combined_dict).length === 0) {
          this.fetchSymbols();
        }
      },

      sortTable(sortKey) {
        this.asc = !this.asc;
        let sortedKeys = Object.keys(this.combined_dict).sort((a, b) => {
          let aValue = Number(this.combined_dict[a][sortKey]);
          let bValue = Number(this.combined_dict[b][sortKey]);
          return this.asc ? aValue - bValue : bValue - aValue;
        });

        let sortedDict = {};
        for (let key of sortedKeys) {
          sortedDict[key] = this.combined_dict[key];
        }

        this.combined_dict = sortedDict;
      },

      async fetchSymbols() {
        this.combined_dict = await this.combineDicts();

        this.sortTable('volume');
        this.asc = !this.asc;
      },
      
      async combineDicts() {
        let combined_dict = {};

        const fr_dict = await this.fetchPremiumIndexes();
        const turnovers_dict = await this.fetch24hrMetrics();

        for (let key in fr_dict) {
          if (turnovers_dict.hasOwnProperty(key)) {
            combined_dict[key] = {...fr_dict[key], ...turnovers_dict[key]};
          }
        }
        return combined_dict;
      },

      formatNumber(value, type) {
        let displayValue;
        if (type === 'mark_price') {
          if (value > 10) {
            displayValue = Math.round(value * 100) / 100;
          } else {
            displayValue = Math.round(value * 10000) / 10000;
          }
        } else if (type === 'change') {
          displayValue = Math.round(value * 100) / 100;
        } else if (type === 'volume') {
          displayValue = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(value);
        }
        return displayValue;
      },

      async fetch24hrMetrics() {
        let turnovers_dict = {};

        const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr`);
        const data = await response.json();
        for (let i of data) {
          let symbol = i['symbol'];
          let volume = i['quoteVolume']
          let changeP = i['priceChangePercent'];

          turnovers_dict[symbol] = {
              'change': changeP,
              'volume': volume
          };
        }
        return turnovers_dict;
      },
      async fetchPremiumIndexes() {
        let fr_dict = {};

        const response = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex`);
        const data = await response.json();
        
        for (let i of data) {
          let symbol = i['symbol'];
          let funding_rate = parseFloat(i['lastFundingRate']) * 100;
          let mark_price = i['markPrice'];

          fr_dict[symbol] = {
              'funding_rate': Math.round(funding_rate * 10000) / 10000,
              'mark_price': mark_price
          };
        }
        return fr_dict;
      },
      async rollingMetrics(symbol) {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`);
        const data = await response.json();

        this.symbolName = data.symbol;
        this.$refs.price24hr.style.color = data.priceChangePercent > 0 ? '#51CDA0' : '#C0504E';

        if (data.priceChangePercent > 0) {
          this.price24hr = `+${data.priceChangePercent}%`;
        } else {
          this.price24hr = `${data.priceChangePercent}%`;
        }

        const formattedVolume = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(data.quoteVolume);
        this.volume24hr = `${formattedVolume}`;
      },
      async fetch_FrOI(symbol) {
        try {
          const response1 = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
          const data1 = await response1.json();
          const formattedFundingRate = new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 4,
          }).format(data1.lastFundingRate);
          this.fundingRate = formattedFundingRate;
          const indexPrice = data1.indexPrice;

          const response2 = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
          const data2 = await response2.json();
          const formattedOpenInterest = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format((data2.openInterest) * Math.round(indexPrice * 10000) / 10000);
          this.openInterestValue = formattedOpenInterest;
          this.openInterestQty = `~${data2.openInterest}`;

          return data2.openInterest;
        } catch (error) {
          console.error(error);
        }
      },
      async fetch_hist_OI(symbol) {
        console.log('Fetching OI history from API...');
        const response = await fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=48`);
        const data = await response.json();
        return data;
      },
      async compare_OI(symbol) {
        let currentOpenInterest = await this.fetch_FrOI(symbol);
        let tsYesterday = Math.round(new Date().getTime()) - (24 * 3600 * 1000);
        let openInterest24HoursAgo;
        this.historicalOpenInterest.forEach(data => {
        if(Math.abs(data.timestamp - tsYesterday) < 3600 * 1000) {
            openInterest24HoursAgo = data.sumOpenInterest;
        }
        });

        let percentageChange = ((currentOpenInterest - openInterest24HoursAgo) / openInterest24HoursAgo) * 100;

        if(percentageChange > 0) {
            this.openInterest24hr = `OI/24hr: +${percentageChange.toFixed(2)}%`;
        } else if(percentageChange < 0) {
            this.openInterest24hr = `OI/24hr: ${percentageChange.toFixed(2)}%`;
        } else {
        console.log(`Open Interest has not changed in the last 24hr`);
        }
      },

      async update_metrics() {
        const symbol = this.currentSymbol;
        this.loader = true;
        this.fetchButtonDisabled = true;

        this.fetch_FrOI(symbol);
        this.rollingMetrics(symbol);
        await this.compare_OI(symbol);

        this.loader = false;
        setTimeout(async () => {        
          this.fetchButtonDisabled = false;
        }, 20000); 
      },

      async handleSymbolChange(newSymbol) {
        this.searchTerm = '';

        if (this.showTable) {
          this.loader = true;
          this.showTable = false;
        }

        console.log('Handling symbol change to ' + newSymbol);
        this.currentSymbol = newSymbol;
        await this.initialize(newSymbol);

        this.$root.worker.postMessage({
          type: 'createWebSocket',
          symbol: newSymbol
        });
      },
      async initialize(symbol) {
        this.rollingMetrics(symbol);
        this.historicalOpenInterest = await this.fetch_hist_OI(symbol);
        this.compare_OI(symbol);
        this.loader = false;
      },
      async terminate_ws() {
        this.terminateButtonDisabled = true;
        this.loader = true;
        this.$root.worker.postMessage({
          type: 'terminateWebsocket'
        });

        await new Promise(resolve => setTimeout(resolve, 1500));
        this.terminateButtonDisabled = false;
        location.reload();
      },

      closeDropdownOnClickOutside(event) {
        const dropdownButton = this.$refs.dropdownButton;
        const symbolDropdown = this.$refs.symbolDropdown;

        if (symbolDropdown && !symbolDropdown.contains(event.target) && !dropdownButton.contains(event.target)) {
          this.showTable = false;
        }
      },
    },
    mounted() {
      //await this.fetchSymbols();
      document.addEventListener('click', this.closeDropdownOnClickOutside);

      setInterval(() => {
        if(this.symbolName) {
          this.compare_OI(this.symbolName);
          this.rollingMetrics(this.symbolName);
        }
      }, 50000);
    },
    beforeUnmount() {
      terminate_ws();
      document.removeEventListener('click', this.closeDropdownOnClickOutside);
    },
  };
</script>

<template>
  <div style="display: grid; grid-template-columns: 1fr 1fr 2fr 1fr 1fr; margin: auto; user-select: none;">

    <div id="symbolContainer" style="grid-column: 3; grid-row: 1;">
      <form method="get" id="symbolForm" style="position: relative;" @submit.prevent>
        <div id="buttonGrid">
          <button type="button" id="navigateButton"><font-awesome-icon icon="fa-solid fa-house" /></button>
          <div id="symbolInputContainer">
            <button id="dropdownButton" ref="dropdownButton" type="button" @click="toggleDropdown()" :disabled="dropdownDisabled" class="dropbtn"> 
              <font-awesome-icon :icon="['fas', 'list']" />
            </button>
            <input ref="symbolInput" v-model="searchTerm" style="margin-right: 1vh;" type="text" id="symbolInput" name="symbol" placeholder="Symbol" @input="handleInput" autocomplete="off"/>
          </div>
          <button type="button" id="terminateButton" :disabled="terminateButtonDisabled" @click="terminate_ws()">Terminate</button>     
          <button type="button" :disabled="fetchButtonDisabled" id="fetchButton" @click="update_metrics()">Fetch metrics</button>
          <div id="rangeContainer">
            <button type="button" id="rangeButton" @click="toggleSlider = !toggleSlider">Min size</button>
            <input type="range" min="500" max="10000" step="250" class="slider" id="minRange" v-model="localMinThreshold" v-show="toggleSlider">
            <div style="font-size: 1vh" v-show="toggleSlider">${{ localMinThreshold }}</div>
          </div>
        </div>
      </form>
    </div>

    <div v-if="loader" id="loader" class="loader" style="grid-column: 4; grid-row: 1;"></div>
    
    <div id="dynamicNumber" style="grid-column: 2; grid-row: 1;">
      <span>{{ symbolName }}</span>
      <div id="symbolProperties" style="text-align: right; font-size: 1.1vh;">
        <text style="opacity: 0.85;">{{ fundingRate }}</text>
        <div ref="openInterestValue" style="display: inline-block;">
          <text style="padding-left: 0.7vh; opacity: 0.85;">{{ openInterestValue }}</text><br>
        </div>
        <div style="font-size: 0.9vh; opacity: 0.5;" ref="openInterestQty">
          <text>{{ openInterestQty }}</text>
        </div>
        <div style="font-size: 0.9vh; opacity: 0.5;" ref="openInterest24hr">
          <text>{{ openInterest24hr }}</text>
        </div>
      </div>
    </div>  

    <div id="volume_box" style="grid-column: 4; grid-row: 1;">
      <span :style="tickerStyle" >{{ tickerPrice }}</span>
      <div id="volumeProperties" style="font-size: 1.1vh;">
        <text style="opacity: 0.85;">{{ volume24hr }}</text>
        <div style="font-size: 1vh; opacity: 0.6; margin-top: 0.4vh;" ref="price24hr">
          <text>{{ price24hr }}</text>
        </div>
      </div>
    </div>

    <transition name="fadeIn_from_top">
      <div v-if="showTable" id="symbolDropdown" ref="symbolDropdown" class="dropdown-content">
        <table>
          <thead>
            <tr>
              <th id="symbolHeader" @click="sortTable('symbol')">Symbol</th>
              <th id="mark_priceHeader" @click="sortTable('mark_price')">Price</th>
              <th id="changeHeader" @click="sortTable('change')">Change</th>
              <th id="funding_rateHeader" @click="sortTable('funding_rate')">Funding</th>           
              <th id="volumeHeader" @click="sortTable('volume')">Volume</th>
            </tr>
          </thead>
          <tbody ref="tBody" id="tableBody">
            <tr v-for="(value, key, index) in filteredItems" :key="key" :class="index % 2 === 0 ? 'even-row' : 'odd-row'" @click="handleSymbolChange(key)">
              <td>{{ key }}</td>
              <td>{{ formatNumber(value.mark_price, 'mark_price') }}</td>
              <td :style="{ color: value.change > 0 ? 'green' : 'red', textAlign: 'right' }">{{ value.change }}%</td>
              <td>{{ value.funding_rate }}</td>
              <td>{{ formatNumber(value.volume, 'volume') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </transition>

  </div>
</template>
    
<style scoped>
  #volume_box, #dynamicNumber {
    font-size: 2.2vh;
    color: rgba(200, 200, 200);
    text-shadow: 2px 4px 4px rgba(0,0,0,0.2), 0px -5px 10px rgba(255,255,255,0.15);
  }

  #volume_box {
    display: inline-block; 
    text-align: left;
    padding-left: 3vw;
  }

  #dynamicNumber {
    display: inline-block; 
    text-align: right;
    padding-right: 3vw;
  }

  #symbolContainer {
    font-family: 'Fira Mono', monospace;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    background-color: #17131A;
    padding: 1.5vh;
    border: 2px solid #4d4d4d;
    box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.2);
    border-radius: 1vh;
  }
  
  #symbolContainer button:hover {
    background-color: #404040; 
    color: rgba(200, 200, 200); 
  }

  #buttonGrid {
    display: flex;
    grid-template-columns: repeat(5, 1fr);
    gap: 1vh;
  }

  #symbolForm button {
    background-color: #38343C;
    color: rgba(200, 200, 200);
    border: none;
    text-align: center;
    font-size: 1.2vh;
    cursor: pointer;
    border-radius: 0.2vh;
    box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.2);
  }

  #symbolInputContainer {
    display: flex;
    align-items: center;
    background-color: #38343C;
    box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.2);
  }

  #symbolInputContainer button {
    background-color: #38343C;
    color: rgba(200, 200, 200);
    border: none;
    text-align: center;
    cursor: pointer;
    border-radius: 0.2vh 0 0 0.2vh;
  }

  #symbolInputContainer input[type=text] {
    border: none;
    font-size: 0.6vw;
    background: #17131A;
    color: rgb(200, 200, 200);
  }

  #symbolInputContainer input[type=text]:hover {
    background-color: #404040; 
  }

  #rangeContainer {
    display: flex;
    align-items: center;
  }
  .slider {
    transition: opacity 0.5s;
    accent-color: rgba(200, 200, 200);
  }

  #rangeContainer button {
    padding: 0.5vh;
  }
  .loader {
    position: relative;
    border: 0.5vh solid #c0c0c0;
    border-radius: 100%;
    border-top: 0.5vh solid #404040;
    width: 1vh;
    height: 1vh;
    -webkit-animation: spin 0.5s ease-in-out infinite;
    animation: spin 0.5s ease-in-out infinite;
    margin-left: 1vw;
    margin-top: 1vh;
    box-shadow: 1px 0px 8px 0px rgba(0, 0, 0, 0.5);
  }
  
  #symbolDropdown {
    text-align: right;
    font-family: 'Fira Mono', monospace;
    background-color: #9f9f9f; 
    color: #17131A;
    backdrop-filter: blur(10px);
    position: absolute;
    overflow: auto;
    z-index: 4;
    height: 40vh; 
    width: 28vw;
    font-size: 0.6vw;
    margin-left: 35%;
    border-radius: 1%;
    padding: 0.5vh;
    margin-top: 6vh;
    box-shadow: 0px 8px 20px 5px rgba(0, 0, 0, 0.5);
  }
  #symbolDropdown table {
    width: 100%;
  }
  @-webkit-keyframes spin {
    0% { -webkit-transform: rotate(0deg); }
    100% { -webkit-transform: rotate(360deg); }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .fade-out {
    animation: fadeOut 0.25s forwards;
  }
  .fadeIn_from_top-enter-active {
    animation: fadeIn_from_top 300ms;
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.5); }
  }
  @keyframes fadeIn_from_bottom {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0px); }
  }
  @keyframes fadeIn_from_top {
    from { opacity: 0; transform: translateY(-20px); }
    to   { opacity: 1; transform: translateY(0px); }
  }
  tr:hover {
    background-color: #d2d2d2; 
    cursor: pointer;
  }
  .even-row {
    background-color: rgb(177, 177, 177);
  }
  .odd-row {
    background-color: #bbbbbb; 
  }

  button:disabled {
    pointer-events: none;
    opacity: 0.33;
  }
</style>