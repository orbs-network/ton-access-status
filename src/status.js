const axios = require('axios');
const HOST = 'https://ton.access.orbs.network';

const units = {
    "v2-mainnet": "/1/mainnet/toncenter-api-v2/getMasterchainInfo",
    "v2-testnet": "/1/testnet/toncenter-api-v2/getMasterchainInfo",
    "v4-mainnet": "/1/mainnet/ton-api-v4/block/latest",
    "v4-testnet": "/1/testnet/ton-api-v4/block/latest",
    "ton-not-exist": "/1/testnet/ton-not-exist/block/latest"
}

const edgeNames = {
    "3847c20C2854E83765d585B86498eFcC7Fec6a46": "be_1",
    "19e116699fd6c7ad754a912af633aafec27cc456": "be_2",
    "1cde611619e2a466c87a23b64870397436082895": "be_3",
    "4d8be7F95Bd3F8B62C092Ab4D238bEE463E655EE": "dls_1",
    "b21c74F113C504144d25BEC6FFA5089ED79a2d6f": "dls_2"
}

// axiousTimeout
const INTERVAL = 15 * 1000;
const AXIOS_TIMEOUT = 1500;

class Status {
    constructor(height, width) {
        this.data = {}
        this.updateing = false;
    }
    async start() {
        await this.monitor();
    }
    async monitor() {
        try {
            await this.update();
            setTimeout(this.monitor.bind(this), INTERVAL);
        } catch (e) {
            this.data.error = e.message;
            this.data.errorTime = Date.now();
            console.error(e);
        }
    }

    async updateUnit(node, name, suffix) {
        const url = HOST + '/' + node.Name + suffix;

        var startTime = performance.now();
        let unit = {
            time: startTime,
            name: name,
            url: url,
            error: null
        }
        // const resp = await axios.get(url, { timeout: AXIOS_TIMEOUT }).catch(function (thrown) {

        //     if (thrown.code === 'ECONNABORTED') {
        //         console.log('Request timeout', url, AXIOS_TIMEOUT);
        //         unit.error = `timeout ${AXIOS_TIMEOUT} ms`;
        //     } else {
        //         // handle error
        //         console.error('Request error', thrown.message);
        //         unit.error = thrown.message;
        //     }
        // })

        let resp;
        try {
            resp = await axios.get(url, { timeout: AXIOS_TIMEOUT });
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
        var endTime = performance.now();
        unit.elapsedMS = Math.round(endTime - startTime);
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
    // async updateNodeUnits(node, units) {
    //     //updateToncenter
    // }
    //////////////////////////////////////////////////
    async updateNodeUnits(node, units) {
        let calls = [];
        for (const name in units) {
            calls.push(this.updateUnit(node, name, units[name]))
        }
        try {
            const units = await Promise.all(calls);
            node.units = units;
            ///console.log(units)
            node.error = null;
        } catch (e) {
            node.error = e;
            console.error(e);
        }
    }
    //////////////////////////////////////////////////
    async update() {
        // prevent double entrance
        if (this.updateing) {
            console.log('update already in progress');
            return;
        }

        var startTime = performance.now();
        this.updateing = true;

        console.time("update status");
        const data = {
            succesTime: Date.now(),
            columns: Object.keys(units)
        };

        const resp = await axios.get(HOST + '/nodes');
        data.nodes = resp.data;

        const calls = [];

        // add ton access nodes
        for (const node of data.nodes) {
            node.edgeName = node.BackendName || edgeNames[node.Name] || "unknown";
            node.displayName = node.Name.slice(0, 4) + '...' + node.Name.slice(-4);
            calls.push(this.updateNodeUnits(node, units));
        };

        // add toncenter call for reference
        //calls.push(this.updateToncenter());

        try {
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