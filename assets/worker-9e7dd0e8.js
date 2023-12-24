(function(){"use strict";console.log("worker_v0.1.3-alpha");class w{constructor(e,r){this.order_book=this.initialize_order_book(e,r)}initialize_order_book(e,r){let s=e.map(n=>n.map(Number)),t=r.map(n=>n.map(Number));return{bids:s,asks:t}}async refresh_order_book(e){h=e;let r=new AbortController,s=setInterval(async()=>{if(!_||e!==h)clearInterval(s),r.abort();else{r=new AbortController;try{let t=await u(e,{signal:r.signal});this.order_book=this.initialize_order_book(t.bids,t.asks)}catch(t){t.name==="AbortError"?console.log("Fetch operation aborted"):console.error("Error fetching order book:",t)}}},6e3)}async update_order_book(e,r){let s=e.map(n=>n.map(Number)),t=r.map(n=>n.map(Number));[this.order_book.bids,this.order_book.asks]=await this.prepare_order_book(this.order_book.bids,this.order_book.asks,s,t)}async prepare_order_book(e,r,s,t){try{const n=new Map([...e,...s].filter(a=>a[0]>=e[e.length-1][0])),p=new Map([...r,...t].filter(a=>a[0]<=r[r.length-1][0]));let b=Array.from(n.entries()).filter(a=>a[1]!==0).sort((a,m)=>m[0]-a[0]),g=Array.from(p.entries()).filter(a=>a[1]!==0).sort((a,m)=>a[0]-m[0]);return b[0][0]>=g[0][0]&&(b=b.filter(a=>a[0]<s[s.length-1][0]),g=g.filter(a=>a[0]>t[0][0]),console.log("Error: bids[0] >= asks[0], rehandled to: ",b[0][0],g[0][0])),[b,g]}catch(n){return console.error("Error preparing order book:",n),s=s.filter(p=>p[0]>=e[e.length-1][0]),t=t.filter(p=>p[0]<=r[r.length-1][0]),[s,t]}}}let i,f=[],h,l,k=!0,_=!0,c,d;self.onmessage=o=>{o.data.type==="createWebSocket"&&E(o.data.symbol),o.data.type==="terminateWebsocket"&&(console.log("worker.js: Terminating websocket connection..."),i.close(),I())};function E(o){i&&i.readyState===1&&(console.log("worker.js: Closing existing websocket connection for symbol:",l.toUpperCase()),i.close(),self.postMessage({type:0}),k=!0,d=null,f=[]),console.log("worker.js: Creating websocket connection for symbol:",o),l=o.toLowerCase(),u(l).then(e=>{i=new WebSocket(`wss://fstream.binance.com/stream?streams=${l}@aggTrade/${l}@depth@100ms`),v(i),c=e.lastUpdateId,d=new w(e.bids,e.asks)}).catch(e=>{console.error("Error initializing the order book:",e)})}function v(o){o.addEventListener("open",()=>{d.refresh_order_book(l),self.postMessage({type:1})}),o.addEventListener("close",()=>{console.log("worker.js: WebSocket connection closed")});let e=!1;o.addEventListener("message",async r=>{let s=JSON.parse(r.data);if(s.stream.endsWith("@aggTrade")){let t=s.data;f.push({x:t.T,y:parseFloat(t.p),r:parseFloat(t.q),m:t.m})}else if(s.stream.endsWith("@depth@100ms")){if(e){console.log("isHandlingDepth:",e);return}e=!0,await M(s.data),e=!1}})}async function M(o){let e=o.u,r=o.U,s=o.pu;if(!(e<c)){if(k)if(r<=c&&c<=e)console.log("First processed event succeed."),k=!1;else{await y();return}else if(s!=c){await y();return}await d.update_order_book(o.b,o.a),c=e,self.postMessage({type:"u",depth:d.order_book,tradesBuffer:f,update_time:o.E}),f=[]}}async function y(){console.log("Out of sync, reinitializing order book...");const o=await u(l);c=o.lastUpdateId,d.order_book=d.initialize_order_book(o.bids,o.asks),f=[]}async function u(o){return await(await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${o}&limit=500`)).json()}function I(){i?(i.close(),_=!1,self.postMessage({type:"x",message:"OK"})):(console.log("worker.js: No websocket connection to terminate."),self.postMessage({type:"x",message:"ERR: No websocket connection to terminate."}))}})();
