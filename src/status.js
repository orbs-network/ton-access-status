const axios = require('axios');
const HOST = 'https://ton.access.orbs.network';

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
    async updateNodeUnits(node, units) {
        let calls = [];
        //let results = [];
        for (const name in units) {
            calls.push(this.updateUnit(node, name, units[name]))
            // serial impl
            //const res = await this.updateUnit(node, name, units[name])
            //results.push(res);
        }
        try {
            node.units = await Promise.all(calls);
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
        return nodes;
    }
    //////////////////////////////////////////////////
    async update() {
        console.log('------------update start')
        var startTime = performance.now();

        console.time("update status");
        const data = {
            succesTime: Date.now(),
            columns: Object.keys(units)
        };

        // const resp = await axios.get(HOST + '/nodes', { timeout: AXIOS_TIMEOUT });
        // data.nodes = resp.data;
        data.nodes = await this.getNodes();

        // add ton access nodes
        const calls = [];
        for (const node of data.nodes) {
            //node.edgeName = node.BackendName || edgeNames[node.Name] || "unknown";
            //node.displayName = node.Name.slice(0, 4) + '...' + node.Name.slice(-4);
            node.displayName = node.NodeId.slice(0, 4) + '...' + node.NodeId.slice(-4);
            calls.push(this.updateNodeUnits(node, units));
        };

        try {
            //await Promise.allSettled(calls);
            await Promise.all(calls);
        } catch (e) {
            console.error(e);
            data.error = 'promiseAll error' + e.message;
        }

        console.timeEnd("update status");
        var endTime = performance.now();
        data.updateDuration = Math.round(endTime - startTime);
        this.updateing = false;

        // return val
        this.data = data;
    }
}


module.exports = new Status();