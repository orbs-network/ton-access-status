const axios = require('axios');
const sendMessageToTelegram = require('./telegram')
const Alert = require('./alert')

require('dotenv').config() // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

const HOST = 'https://ton.access.orbs.network';

const units = {
    "v2-mainnet": "/1/mainnet/toncenter-api-v2/getMasterchainInfo",
    "v2-testnet": "/1/testnet/toncenter-api-v2/getMasterchainInfo",
    "v4-mainnet": "/1/mainnet/ton-api-v4/block/latest",
    "v4-testnet": "/1/testnet/ton-api-v4/block/latest"//,
    //"ton-not-exist": "/1/testnet/ton-not-exist/block/latest"
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
const AXIOS_TIMEOUT = 5000;

class Status {
    constructor() {
        this.data = {}
        this.tickIndex = 0;
        this.needUpdate = false;
        this.edgeSvcUrl = `https://api.fastly.com/service/${process.env.FASTLY_SERVICE_ID}`;

        this.edgeHeaders = {
            'Fastly-Key': process.env.FASTLY_API_KEY,
            'Accept': 'application/json'
        }
        this.alert = new Alert();
    }

    //////////////////////////////////////////////////
    async start() {
        //await sendMessageToTelegram('\u2705 Status page started');

        //await this.monitor();
        //await this.benchmarkTick();
        this.updateSetLoop();
        this.updateGetLoop();
    }
    //////////////////////////////////////////////////
    // refresh benchmark every 5 minutes
    // async benchmarkTick() {
    //     // now first
    //     await this.updateBenchmark();
    //     const interval = 5 * 60 * 1000
    //     setInterval(async () => {
    //         try {
    //             await this.updateBenchmark();
    //         } catch (e) {
    //             console.error('benchmarkTick', e);
    //         }
    //     }, interval);
    // }
    //////////////////////////////////////////////////
    updateSetLoop() {
        const interval = 2 * 60 * 1000
        this.needUpdate = true;
        setInterval(async () => {
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
                    //this.data = require('../status-mock.json');
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
        node.mngr.url = url;
        try {
            const resp = await axios.get(url, { timeout: AXIOS_TIMEOUT });
            if (resp.status === 200) {
                node.mngr = resp.data;
                // update health in units
                for (let unit of node.units) {
                    // for UI                    
                    unit.mngrHealth = node.mngr.health.hasOwnProperty(unit.name) ? node.mngr.health[unit.name] : "missing";
                }
            }
            else {
                node.mngr.error = `wrong status ${resp.status} `;
            }
            // for UI
            node.mngr.url = url;
        }
        catch (err) {
            node.mngr.error = `erro code ${err.code}`;
            if (err.code === 'ECONNABORTED') {
                console.error('Request timeout', url, AXIOS_TIMEOUT);
            }
            //else {
            //     // handle error
            //     if (url.indexOf('ton-not-exist') == -1) { // filter out purposely error
            //         console.error('Request error', err.message, url);
            //     }
            //     //unit.error = err.message;
            // }
        }
    }
    //////////////////////////////////////////////////
    async updateMngrNodesApi(node) {
        const url = `http://${node.Ip}/mngr/nodes`;
        node.mngr.nodesApi = {
            status: -1,
            resp: "",
            url: url
        }
        try {
            const resp = await axios.get(url, { timeout: AXIOS_TIMEOUT });
            node.mngr.nodesApi.status = resp.status;

            if (resp.status === 200) {
                node.mngr.nodesApi.resp = resp.data;
                node.mngr.nodesApi.url = url;
            }
        }
        catch (err) {
            node.mngr.nodesApi.error = err.message;
            if (err.code === 'ECONNABORTED') {
                console.error('Request timeout', url, AXIOS_TIMEOUT);
            } else {
                console.error('Request error', err.message, url);
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
                console.error('Request timeout', url, AXIOS_TIMEOUT);
                unit.error = `timeout ${AXIOS_TIMEOUT} ms`;
            }
            // else {
            //     // handle error
            //     if (url.indexOf('ton-not-exist') == -1) { // filter out purposely error
            //         console.error('Request error', err.message, url);
            //     }
            //     unit.error = err.message;
            // }
        }
        // elapsed and benchmark
        var endTime = performance.now();
        unit.elapsedMS = Math.round(endTime - startTime);

        // benchmark
        // if (benchmark[unit.name]?.elapsedMS) {
        //     const benchmarkMS = benchmark[unit.name].elapsedMS;
        //     unit.benchmarkMS = unit.elapsedMS - benchmarkMS;
        // }

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
        // create and update units for this node
        node.units = []
        for (const name in units) {
            const unit = await this.updateUnit(node, name, units[name]).catch(e => {
                console.error('updateUnit', e);
            });
            node.units.push(unit);
        }

        try {
            // manager after units so their helth can be updated
            await this.updateMngr(node)
            await this.updateMngrNodesApi(node)

            ///console.log(units)
            node.error = null;
        } catch (e) {
            node.error = e;
            console.error(e);
        }
    }
    //////////////////////////////////////////////////
    // async updateBenchmarkProtocol(bm) {
    //     const startTime = performance.now();
    //     bm.elapsedMS = -1;
    //     try {
    //         await axios.get(bm.url, { timeout: AXIOS_TIMEOUT });
    //         bm.elapsedMS = Math.round(performance.now() - startTime);
    //     }
    //     catch (err) {
    //         if (err.code === 'ECONNABORTED') {
    //             console.log('Benchmark Request timeout', bm.url, AXIOS_TIMEOUT);
    //             duration = Math.round(endTime - startTime);
    //         } else {
    //             console.error('Benchmark Request error', err.message, bm.url);
    //         }
    //     }
    // }
    //////////////////////////////////////////////////
    // async updateBenchmark() {
    //     console.time("updateBenchmark");
    //     // make serial
    //     for (const protocol in benchmark) {
    //         //calls.push(this.updateBenchmarkProtocol(benchmark[protocol]))
    //         await this.updateBenchmarkProtocol(benchmark[protocol]).catch(e => {
    //             console.error('updateBenchmarkProtocol', protocol, e);
    //         });
    //     }
    //     //await Promise.all(calls);
    //     console.timeEnd("updateBenchmark");
    // }
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
            const active = this.beName2Id.hasOwnProperty(backend.name);
            if (active) {
                nodes.push({
                    "NodeId": active ? this.beName2Id[backend.name] : "off-edge",
                    "BackendName": backend.name,
                    "Ip": backend.address,
                    "Weight": backend.weight,
                    "Healthy": "1",
                    "_active": active
                });
            }
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
    async update() {
        console.debug('------------update start')
        var startTime = performance.now();

        const data = {
            succesTime: Date.now(),
            columns: Object.keys(units)
        };

        data.nodes = await this.getNodes();

        // make serial
        for (const node of data.nodes) {
            if (node._active) { // update only active nodes
                // set display name
                node.displayName = node.NodeId.slice(0, 4) + '...' + node.NodeId.slice(-4);
                // get
                await this.updateNode(node, units).catch(e => {
                    console.error(e);
                    data.error = 'updateNode' + e.message;
                });
            }
        };

        // trigger alerts
        if (data.nodes.length) {
            await this.alert.checkProtonetAccross(benchmark, data);
            await this.alert.checkConsistNodesApi(data.nodes);
            data.alert = this.alert.status();
        }

        var endTime = performance.now();
        data.updateDuration = Math.round(endTime - startTime);

        if (!this.tickIndex % 10) {
            console.log(this.tickIndex, `update time: ${parseInt(data.updateDuration / 1000)} sec`);
        }
        this.tickIndex++;

        // return val - deep copy for consistancy
        this.data = JSON.parse(JSON.stringify(data));
    }
}


module.exports = new Status();