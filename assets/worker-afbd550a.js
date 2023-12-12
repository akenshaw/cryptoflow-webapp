(function(){"use strict";class h{constructor(e,t){this.order_book=this.initialize_order_book(e,t)}initialize_order_book(e,t){let s=e.map(n=>n.map(Number)),a=t.map(n=>n.map(Number));return{bids:s,asks:a}}async refresh_order_book(e){_=e;let t=new AbortController,s=setInterval(async()=>{if(!k||e!==_)clearInterval(s),t.abort();else{t=new AbortController;try{let a=await b(e,{signal:t.signal});this.order_book=this.initialize_order_book(a.bids,a.asks)}catch(a){a.name==="AbortError"?console.log("Fetch operation aborted"):console.error("Error fetching order book:",a)}}},6e3)}async update_order_book(e,t){let s=e.map(n=>n.map(Number)),a=t.map(n=>n.map(Number));[this.order_book.bids,this.order_book.asks]=await this.prepare_order_book(this.order_book.bids,this.order_book.asks,s,a)}async prepare_order_book(e,t,s,a){const n=new Map(s.map(o=>[o[0],o[1]])),g=new Map(a.map(o=>[o[0],o[1]]));return e=e.map(o=>[o[0],n.has(o[0])?n.get(o[0]):o[1]]),t=t.map(o=>[o[0],g.has(o[0])?g.get(o[0]):o[1]]),e=e.concat([...n.entries()].filter(([o,p])=>!e.some(m=>m[0]===o))),t=t.concat([...g.entries()].filter(([o,p])=>!t.some(m=>m[0]===o))),e=e.filter(o=>o[1]!==0).sort((o,p)=>p[0]-o[0]),t=t.filter(o=>o[1]!==0).sort((o,p)=>o[0]-p[0]),[e,t]}}let i,f=[],_,l,u=!0,k=!0,c,d;self.onmessage=r=>{r.data.type==="createWebSocket"&&w(r.data.symbol),r.data.type==="terminateWebsocket"&&(console.log("worker.js: Terminating websocket connection..."),i.close(),E())};function w(r){i&&i.readyState===1&&(console.log("worker.js: Closing existing websocket connection for symbol:",l.toUpperCase()),i.close(),self.postMessage({type:0}),u=!0,d=null,f=[]),console.log("worker.js: Creating websocket connection for symbol:",r),l=r.toLowerCase(),b(l).then(e=>{i=new WebSocket(`wss://fstream.binance.com/stream?streams=${l}@aggTrade/${l}@depth@100ms`),y(i),c=e.lastUpdateId,d=new h(e.bids,e.asks)}).catch(e=>{console.error("Error initializing the order book:",e)})}function y(r){r.addEventListener("open",()=>{self.postMessage({type:1}),d.refresh_order_book(l)}),r.addEventListener("close",()=>{console.log("worker.js: WebSocket connection closed")});let e=!1;r.addEventListener("message",async t=>{let s=JSON.parse(t.data);if(s.stream.endsWith("@aggTrade")){let a=s.data;f.push({x:a.T,y:parseFloat(a.p),r:parseFloat(a.q),m:a.m})}else if(s.stream.endsWith("@depth@100ms")){if(e){console.log("isHandlingDepth:",e);return}e=!0,await v(s.data),e=!1}})}async function v(r){let e,t=r.u,s=r.U,a=r.pu;if(!(t<c)){if(u)if(s<=c&&c<=t)console.log("First processed event succeed."),u=!1;else{console.log("Out of sync at the first event, reinitializing order book..."),e=await b(l),c=e.lastUpdateId,await d.update_order_book(e.bids,e.asks);return}else if(a!=c){console.log("Out of sync, reinitializing order book..."),e=await b(l),c=e.lastUpdateId,await d.update_order_book(e.bids,e.asks);return}await d.update_order_book(r.b,r.a),c=t,self.postMessage({type:"u",depth:d.order_book,tradesBuffer:f,update_time:r.E}),f=[]}}async function b(r){return await(await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${r}&limit=500`)).json()}function E(){i?(i.close(),k=!1,self.postMessage({type:"x",message:"OK"})):(console.log("worker.js: No websocket connection to terminate."),self.postMessage({type:"x",message:"ERR: No websocket connection to terminate."}))}})();
