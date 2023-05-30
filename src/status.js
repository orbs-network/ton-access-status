const axios = require('axios');
const sendMessageToTelegram = require('./telegram')
const HOST = 'https://ton.access.orbs.network';
require('dotenv').config() // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

const units = {
    "v2-mainnet": "/1/mainnet/toncenter-api-v2/getMasterchainInfo",
    "v2-testnet": "/1/testnet/toncenter-api-v2/getMasterchainInfo",
    "v4-mainnet": "/1/mainnet/ton-api-v4/block/latest",
    "v4-testnet": "/1/testnet/ton-api-v4/block/latest",
    "ton-not-exist": "/1/testnet/ton-not-exist/block/latest"
}
const benchmark = {
    "v2-mainnet": { url: "https://toncenter.com/api/v2/getMasterchainInfo" },
    "v2-testnet": { url: "https://testnet.toncenter.com/api/v2/getMasterchainInfo" },
    "v4-mainnet": { url: "https://mainnet-v4.tonhubapi.com/block/latest" },
    "v4-testnet": { url: "https://testnet-v4.tonhubapi.com/block/latest" }
}

// const edgeNames = {
//     "3847c20C2854E83765d585B86498eFcC7Fec6a46": "be_1",
//     "19e116699fd6c7ad754a912af633aafec27cc456": "be_2",
//     "1cde611619e2a466c87a23b64870397436082895": "be_3",
//     "4d8be7F95Bd3F8B62C092Ab4D238bEE463E655EE": "dls_1",
//     "b21c74F113C504144d25BEC6FFA5089ED79a2d6f": "dls_2"
// }

// const beName2ID = {
//     "be1": "3847c20C2854E83765d585B86498eFcC7Fec6a46",
//     "be2": "19e116699fd6c7ad754a912af633aafec27cc456",
//     "be3": "1cde611619e2a466c87a23b64870397436082895",
//     "dls1": "4d8be7F95Bd3F8B62C092Ab4D238bEE463E655EE",
//     "dls2": "b21c74F113C504144d25BEC6FFA5089ED79a2d6f"
// }

// axiousTimeout
//const INTERVAL = 60 * 1000;
const AXIOS_TIMEOUT = 1500;

class Status {
    constructor() {
        this.data = {}
        //this.updateing = false;
        this.needUpdate = false;
        this.edgeSvcUrl = `https://api.fastly.com/service/${process.env.FASTLY_SERVICE_ID}`;

        this.edgeHeaders = {
            'Fastly-Key': process.env.FASTLY_API_KEY,
            'Accept': 'application/json'
        }

    }

    //////////////////////////////////////////////////
    async start() {
        sendMessageToTelegram('\u2705 Status page started');

        //await this.monitor();
        await this.benchmarkTick();
        this.updateSetLoop();
        this.updateGetLoop();
    }
    //////////////////////////////////////////////////
    // refresh benchmark every 5 minutes
    async benchmarkTick() {
        // now first
        await this.updateBenchmark();
        const interval = 5 * 60 * 1000
        setInterval(async () => {
            try {
                await this.updateBenchmark();
            } catch (e) {
                console.error('benchmarkTick', e);
            }
        }, interval);
    }
    //////////////////////////////////////////////////
    updateSetLoop() {
        const interval = 1 * 60 * 1000
        this.needUpdate = true;
        setInterval(() => {
            this.needUpdate = true;
        }, interval);
    }
    //////////////////////////////////////////////////
    async updateGetLoop() {
        setInterval(async () => {
            //while (true) {        
            if (this.needUpdate) {
                try {
                    this.needUpdate = false;
                    await this.update();
                }
                catch (e) {
                    console.error('updateLoop', e);
                    this.data.error = e.message;
                    this.data.errorTime = Date.now();
                }
            }
        }, 1000);
    }
    //////////////////////////////////////////////////
    async updateMngr(node) {
        const url = `http://${node.Ip}/mngr/`;
        node.mngr = {}
        try {
            const resp = await axios.get(url, { timeout: AXIOS_TIMEOUT });

            if (resp.status === 200) {
                node.mngr = resp.data;
                node.mngr.url = url;
                // update health in units
                for (let unit of node.units) {
                    // for UI                    
                    unit.mngrHealth = node.mngr.health.hasOwnProperty(unit.name) ? node.mngr.health[unit.name] : "missing";
                    if (node.BackendName == "am1") {
                        // if (unit.name === "v4-mainnet") {
                        //     // cube
                        //     unit.status = 500;
                        //     unit.error = "alterred";
                        //     // mngr
                        //     unit.mngrHealth = true;
                        // }
                    }
                }

            } else {
                node.mngr.error = `wrong status ${resp.status}`;
            }
        }
        catch (err) {
            node.mngr.error = `erro code ${err.code}`;
            if (err.code === 'ECONNABORTED') {
                console.log('Request timeout', url, AXIOS_TIMEOUT);
            } else {
                // handle error
                if (url.indexOf('ton-not-exist') == -1) { // filter out purposely error
                    console.error('Request error', err.message, url);
                }
                //unit.error = err.message;
            }
        }
    }
    //////////////////////////////////////////////////
    async updateUnit(node, name, suffix) {
        const url = HOST + '/' + node.NodeId + suffix;

        var startTime = performance.now();
        let unit = {
            time: startTime,
            name: name,
            url: url,
            error: null
        }

        let resp;
        try {
            resp = await axios.get(url, { timeout: AXIOS_TIMEOUT });
            // DEBUG
            // if (url.indexOf('v4') > -1) {
            //     console.log('url', url);
            //     console.log(resp.data);
            // }
        }
        catch (err) {
            if (err.code === 'ECONNABORTED') {
                console.log('Request timeout', url, AXIOS_TIMEOUT);
                unit.error = `timeout ${AXIOS_TIMEOUT} ms`;
            } else {
                // handle error
                if (url.indexOf('ton-not-exist') == -1) { // filter out purposely error
                    console.error('Request error', err.message, url);
                }
                unit.error = err.message;
            }
        }
        // elapsed and benchmark
        var endTime = performance.now();
        unit.elapsedMS = Math.round(endTime - startTime);

        // benchmark
        if (benchmark[unit.name]?.elapsedMS) {
            const benchmarkMS = benchmark[unit.name].elapsedMS;
            unit.benchmarkMS = unit.elapsedMS - benchmarkMS;
        }

        if (resp) {
            unit.status = resp.status;
            unit.data = resp.data;

            // per protocol valid data
            if (name.slice(0, 2) === 'v2') {
                unit.seqno = unit.data.result.last.seqno;
            }
            else if (name.slice(0, 2) === 'v4') {
                unit.seqno = unit.data.last.seqno;
            }
        }
        return unit;
    }
    //////////////////////////////////////////////////
    async updateNode(node, units) {
        let calls = [];
        //let results = [];
        for (const name in units) {
            calls.push(this.updateUnit(node, name, units[name]));
        }

        try {
            node.units = await Promise.all(calls);

            // manager after units so their helth can be updated
            await this.updateMngr(node)

            ///console.log(units)
            node.error = null;
        } catch (e) {
            node.error = e;
            console.error(e);
        }
    }
    //////////////////////////////////////////////////
    async updateBenchmarkProtocol(bm) {
        const startTime = performance.now();
        bm.elapsedMS = -1;
        try {
            await axios.get(bm.url, { timeout: AXIOS_TIMEOUT });
            bm.elapsedMS = Math.round(performance.now() - startTime);
        }
        catch (err) {
            if (err.code === 'ECONNABORTED') {
                console.log('Benchmark Request timeout', bm.url, AXIOS_TIMEOUT);
                duration = Math.round(endTime - startTime);
            } else {
                console.error('Benchmark Request error', err.message, bm.url);
            }
        }
    }
    //////////////////////////////////////////////////
    async updateBenchmark() {
        console.time("updateBenchmark");
        let calls = [];
        for (const protocol in benchmark) {
            calls.push(this.updateBenchmarkProtocol(benchmark[protocol]))
            //await this.updateBenchmarkProtocol(benchmark[protocol]);
        }
        await Promise.all(calls);
        console.timeEnd("updateBenchmark");
    }
    //////////////////////////////////////////////////
    async callEdgeApi(method) {
        const url = `${this.edgeSvcUrl}/${method}`;
        return await axios.get(url, {
            headers: this.edgeHeaders,
            timeout: AXIOS_TIMEOUT
        });
    }
    //////////////////////////////////////////////////
    async getNodes() {
        // get active version
        const version = await this.callEdgeApi(`version/active`);
        // get backend names
        const table = await this.callEdgeApi(`version/${version.data.number}/dictionary/beName2Id`);
        // get items
        const items = await this.callEdgeApi(`dictionary/${table.data.id}/items`);
        // populate
        this.beName2Id = {}
        for (const item of items.data) {
            this.beName2Id[item.item_key] = item.item_value;
        }

        // get backends edge api
        const backends = await this.callEdgeApi(`version/${version.data.number}/backend`);
        const nodes = [];
        for (const backend of backends.data) {
            nodes.push({
                "NodeId": this.beName2Id[backend.name],
                "BackendName": backend.name,
                "Ip": backend.address,
                "Weight": backend.weight,
                "Healthy": "1"
            });
        }

        // add dev node 18.118.210.152
        // nodes.push({
        //     "NodeId": "not-on-edge",
        //     "BackendName": "DEV",
        //     "Ip": "18.118.210.152",
        //     "Weight": 0,
        //     "Healthy": "1"
        // });

        return nodes;
    }
    //////////////////////////////////////////////////
    checkHealthProtonet(nodes, protonet) {
        // alert if manager health per protocol is False across all nodes
        // return true if atleast one node is health
        let health = false;
        for (const node of nodes) {
            if (node.mngr?.health)
                health |= node.mngr.health[protonet];
        }
        return health;
    }
    //////////////////////////////////////////////////
    checkAlerts(data) {
        for (const protonet in benchmark) {
            if (!this.checkHealthProtonet(data.nodes, protonet)) {
                // entire protonet is unhealthy across all nodes
                const msg = `\u{1F6A8} ${protonet} is not healthy on all node!`;
                console.log(JSON.stringify(data, null, '\t'));
                console.error(msg);
                sendMessageToTelegram(msg);
            }
        }

    }
    //////////////////////////////////////////////////
    async update() {
        console.debug('------------update start')
        var startTime = performance.now();

        console.time("update status");
        const data = {
            succesTime: Date.now(),
            columns: Object.keys(units)
        };

        data.nodes = await this.getNodes();

        // add ton access nodes
        const calls = [];
        for (const node of data.nodes) {
            node.displayName = node.NodeId.slice(0, 4) + '...' + node.NodeId.slice(-4);
            calls.push(this.updateNode(node, units));
        };

        try {
            await Promise.all(calls);
        } catch (e) {
            console.error(e);
            data.error = 'promiseAll error' + e.message;
        }

        if (data.nodes.length)
            this.checkAlerts(data);

        console.timeEnd("update status");
        var endTime = performance.now();
        data.updateDuration = Math.round(endTime - startTime);
        this.updateing = false;

        // return val
        this.data = data;
    }
}


module.exports = new Status();