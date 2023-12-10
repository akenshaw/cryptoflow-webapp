import { watch } from 'vue';
import { defineStore } from 'pinia';

export const useThresholdsStore = defineStore('thresholds', {
  state: () => ({
    minThreshold: 500,
    thresholds: [ 
        500, 700, 1000, 1400, 2000, 2800, 4000, 5600, 7900, 
        11100, 15600, 21900, 30800, 43200, 60600, 85000, 
        119000, 167000, 234000, 329000, 462000, 649000, 911000, 
        1278000, 1792000, 2520000
    ],
  }),
  
  actions: {
    setMinThreshold(newMinThreshold) {
      if (this.thresholds[0] !== newMinThreshold) {
        const factor = newMinThreshold / this.minThreshold;
        this.scaleThresholds(factor);
      };
    },
    scaleThresholds(factor) {
      this.thresholds = this.thresholds.map((threshold) => Math.round(threshold * factor));
      this.minThreshold = this.thresholds[0];
    },    
  },
});
