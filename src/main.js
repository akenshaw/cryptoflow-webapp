import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import VueGtag from 'vue-gtag'

const pinia = createPinia()
const app = createApp(App)

app.use(VueGtag, {
    config: { id: 'G-KEY1KX2BLG' }
})

app.use(pinia)
app.mount('#app')
