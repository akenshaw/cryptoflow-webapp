console.log("worker_v0.1.1-alpha");

class OrderBook {
    constructor(bids, asks) {
        this.order_book = this.initialize_order_book(bids, asks);
    };

    initialize_order_book(bids, asks) {
        let bids_array = bids.map(bid => bid.map(Number));
        let asks_array = asks.map(ask => ask.map(Number));

        return {'bids': bids_array, 'asks': asks_array};
    };
    
    async refresh_order_book(symbol) {
        currentSymbol = symbol;
        let controller = new AbortController();
        let intervalId = setInterval(async () => {
            if (!shouldRefresh || symbol !== currentSymbol) {
                clearInterval(intervalId);
                controller.abort(); 
            } else {
                controller = new AbortController(); 
                try {
                    let data = await fetchOrderbook(symbol, { signal: controller.signal });
                    this.order_book = this.initialize_order_book(data.bids, data.asks);
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('Fetch operation aborted');
                    } else {
                        console.error('Error fetching order book:', error);
                    }
                }
            }
        }, 6000);
    }

    async update_order_book(new_bids, new_asks) {
        let bids_array = new_bids.map(bid => bid.map(Number));
        let asks_array = new_asks.map(ask => ask.map(Number));

        [this.order_book['bids'], this.order_book['asks']] = await this.prepare_order_book(
            this.order_book['bids'], this.order_book['asks'], bids_array, asks_array);
    };

    async prepare_order_book(bids, asks, new_bids, new_asks) {
        const bidsMap = new Map([...bids, ...new_bids].filter(bid => bid[0] >= bids[bids.length-1][0]));
        const asksMap = new Map([...asks, ...new_asks].filter(ask => ask[0] <= asks[asks.length-1][0]));

        bids = Array.from(bidsMap.entries()).filter(bid => bid[1] !== 0).sort((a, b) => b[0] - a[0]);
        asks = Array.from(asksMap.entries()).filter(ask => ask[1] !== 0).sort((a, b) => a[0] - b[0]);

        return [bids, asks];
    };
}

let socket;
let aggTradeBuffer = [];

let currentSymbol;
let lowercaseSymbol;
let is_first_event = true;
let shouldRefresh = true;

let last_update_id;
let order_book;

self.onmessage = (event) => {
    if (event.data.type === 'createWebSocket') {
        createWebSocket(event.data.symbol);
    }
    if (event.data.type === 'terminateWebsocket') {
        console.log('worker.js: Terminating websocket connection...');
        socket.close();
        terminate();
    }
};

function createWebSocket(symbol) {
    if (socket && socket.readyState === 1) {
        console.log('worker.js: Closing existing websocket connection for symbol:', lowercaseSymbol.toUpperCase());
        socket.close();

        self.postMessage({ type: 0});

        is_first_event = true;
        order_book = null;
        aggTradeBuffer = [];
    }
    console.log('worker.js: Creating websocket connection for symbol:', symbol);
    lowercaseSymbol = symbol.toLowerCase();

    fetchOrderbook(lowercaseSymbol)
        .then(depth_snapshot => {
            socket = new WebSocket(`wss://fstream.binance.com/stream?streams=${lowercaseSymbol}@aggTrade/${lowercaseSymbol}@depth@100ms`); 
            setupEventListeners(socket);

            last_update_id = depth_snapshot.lastUpdateId;
            order_book = new OrderBook(depth_snapshot.bids, depth_snapshot.asks);
        })
        .catch(error => {
            console.error('Error initializing the order book:', error);
        });
}

function setupEventListeners(socket) {
    socket.addEventListener('open', () => {
        self.postMessage({ type: 1 });
        order_book.refresh_order_book(lowercaseSymbol);
    });
    socket.addEventListener('close', () => {
        console.log('worker.js: WebSocket connection closed');
    });

    let isHandlingDepth = false;
    socket.addEventListener('message', async (event) => {   
        let message = JSON.parse(event.data);
    
        if (message.stream.endsWith('@aggTrade')) {
            let aggtradeStream = message.data;
            aggTradeBuffer.push({
                x: aggtradeStream.T,
                y: parseFloat(aggtradeStream.p),
                r: parseFloat(aggtradeStream.q),
                m: aggtradeStream.m,
            });
    
        } else if (message.stream.endsWith('@depth@100ms')) {
            if (isHandlingDepth) {
                console.log('isHandlingDepth:', isHandlingDepth);
                return;
            }
            isHandlingDepth = true;
            await handleDepth(message.data);

            isHandlingDepth = false;
        };
    });    
}

async function handleDepth(depthStream) {  
    let finalUpdateId = depthStream.u;
    let firstUpdateId = depthStream.U;
    let previousFinalUpdateId = depthStream.pu;

    if (finalUpdateId < last_update_id) {
        return; 
    }
    if (is_first_event) {
        if (firstUpdateId <= last_update_id && last_update_id <= finalUpdateId) {
            console.log("First processed event succeed.")
            is_first_event = false;
        } else {
            await reinitializeOrderBook();
            return;
        }
    } else if (previousFinalUpdateId != last_update_id) {
        await reinitializeOrderBook();
        return;
    }    

    await order_book.update_order_book(depthStream.b, depthStream.a);
    last_update_id = finalUpdateId;

    self.postMessage({ type: 'u', depth: order_book.order_book, tradesBuffer: aggTradeBuffer, update_time: depthStream.E });
    aggTradeBuffer = [];
}

async function reinitializeOrderBook() {
    console.log('Out of sync, reinitializing order book...');
    const depth_snapshot = await fetchOrderbook(lowercaseSymbol);
    last_update_id = depth_snapshot.lastUpdateId;
    order_book.order_book = order_book.initialize_order_book(depth_snapshot.bids, depth_snapshot.asks);
    aggTradeBuffer = [];
}

async function fetchOrderbook(lowercaseSymbol) {
    const response = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${lowercaseSymbol}&limit=500`);
    const data = await response.json();
    return data;
}

function terminate() {
    if (socket) {
        socket.close();
        shouldRefresh = false;
        self.postMessage({ type: 'x', message: 'OK' });
    } else {
        console.log('worker.js: No websocket connection to terminate.');
        self.postMessage({ type: 'x', message: 'ERR: No websocket connection to terminate.' });
    }
}


