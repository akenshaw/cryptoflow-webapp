(function(){"use strict";console.log("worker_v0.1.1-alpha");class y{constructor(e,t){this.order_book=this.initialize_order_book(e,t)}initialize_order_book(e,t){let s=e.map(n=>n.map(Number)),a=t.map(n=>n.map(Number));return{bids:s,asks:a}}async refresh_order_book(e){_=e;let t=new AbortController,s=setInterval(async()=>{if(!k||e!==_)clearInterval(s),t.abort();else{t=new AbortController;try{let a=await b(e,{signal:t.signal});this.order_book=this.initialize_order_book(a.bids,a.asks)}catch(a){a.name==="AbortError"?console.log("Fetch operation aborted"):console.error("Error fetching order book:",a)}}},6e3)}async update_order_book(e,t){let s=e.map(n=>n.map(Number)),a=t.map(n=>n.map(Number));[this.order_book.bids,this.order_book.asks]=await this.prepare_order_book(this.order_book.bids,this.order_book.asks,s,a)}async prepare_order_book(e,t,s,a){s=s.filter(o=>o[0]>=e[e.length-1][0]),a=a.filter(o=>o[0]<=t[t.length-1][0]);const n=new Map(s.map(o=>[o[0],o[1]])),m=new Map(a.map(o=>[o[0],o[1]]));return e=e.map(o=>[o[0],n.has(o[0])?n.get(o[0]):o[1]]),t=t.map(o=>[o[0],m.has(o[0])?m.get(o[0]):o[1]]),e=e.concat([...n.entries()].filter(([o,f])=>!e.some(u=>u[0]===o))),t=t.concat([...m.entries()].filter(([o,f])=>!t.some(u=>u[0]===o))),e=e.filter(o=>o[1]!==0).sort((o,f)=>f[0]-o[0]),t=t.filter(o=>o[1]!==0).sort((o,f)=>o[0]-f[0]),[e,t]}}let i,p=[],_,l,g=!0,k=!0,c,d;self.onmessage=r=>{r.data.type==="createWebSocket"&&w(r.data.symbol),r.data.type==="terminateWebsocket"&&(console.log("worker.js: Terminating websocket connection..."),i.close(),M())};function w(r){i&&i.readyState===1&&(console.log("worker.js: Closing existing websocket connection for symbol:",l.toUpperCase()),i.close(),self.postMessage({type:0}),g=!0,d=null,p=[]),console.log("worker.js: Creating websocket connection for symbol:",r),l=r.toLowerCase(),b(l).then(e=>{i=new WebSocket(`wss://fstream.binance.com/stream?streams=${l}@aggTrade/${l}@depth@100ms`),v(i),c=e.lastUpdateId,d=new y(e.bids,e.asks)}).catch(e=>{console.error("Error initializing the order book:",e)})}function v(r){r.addEventListener("open",()=>{self.postMessage({type:1}),d.refresh_order_book(l)}),r.addEventListener("close",()=>{console.log("worker.js: WebSocket connection closed")});let e=!1;r.addEventListener("message",async t=>{let s=JSON.parse(t.data);if(s.stream.endsWith("@aggTrade")){let a=s.data;p.push({x:a.T,y:parseFloat(a.p),r:parseFloat(a.q),m:a.m})}else if(s.stream.endsWith("@depth@100ms")){if(e){console.log("isHandlingDepth:",e);return}e=!0,await E(s.data),e=!1}})}async function E(r){let e=r.u,t=r.U,s=r.pu;if(!(e<c)){if(g)if(t<=c&&c<=e)console.log("First processed event succeed."),g=!1;else{await h();return}else if(s!=c){await h();return}await d.update_order_book(r.b,r.a),c=e,self.postMessage({type:"u",depth:d.order_book,tradesBuffer:p,update_time:r.E}),p=[]}}async function h(){console.log("Out of sync, reinitializing order book...");const r=await b(l);c=r.lastUpdateId,d.order_book=d.initialize_order_book(r.bids,r.asks),p=[]}async function b(r){return await(await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${r}&limit=500`)).json()}function M(){i?(i.close(),k=!1,self.postMessage({type:"x",message:"OK"})):(console.log("worker.js: No websocket connection to terminate."),self.postMessage({type:"x",message:"ERR: No websocket connection to terminate."}))}})();
