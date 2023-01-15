const axios = require('axios');
let status = {};
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

async function monitor() {
    try {
        let cur = await renderStatus();
        status = cur;
        setTimeout(monitor, 1000 * 60);
    } catch (e) {
        status.error = e.message;
        status.errorTime = Date.now();
        console.error(e);
    }
}

async function renderUnit(node, name, suffix) {
    const url = HOST + '/' + node.Name + suffix;

    var startTime = performance.now();
    let unit = {
        time: startTime,
        name: name,
        url: url,
        error: null
    }

    try {
        const resp = await axios.get(url);
        var endTime = performance.now();
        unit.status = resp.status;
        unit.data = resp.data;
        unit.elapsedMS = Math.round(endTime - startTime);

        // per protocol valid data
        if (name.slice(0, 2) === 'v2') {
            unit.seqno = unit.data.result.last.seqno;
        }
        else if (name.slice(0, 2) === 'v4') {
            unit.seqno = unit.data.last.seqno;
        }
    } catch (e) {
        unit.error = e.message;
    }

    return unit;
}

async function renderNodeUnits(node, units) {
    let calls = [];
    for (const name in units) {
        calls.push(renderUnit(node, name, units[name]))
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
async function renderStatus() {
    const resp = await axios.get(HOST + '/nodes');
    const status = {
        nodes: resp.data,
        succesTime: Date.now(),
        columns: Object.keys(units)
    };


    const calls = [];
    for (const node of status.nodes) {
        node.edgeName = edgeNames[node.Name] || "unkown";
        node.displayName = node.Name.slice(0, 4) + '...' + node.Name.slice(-4);
        calls.push(renderNodeUnits(node, units));
    };
    await Promise.all(calls);
    //console.log(status)
    return status;
}

module.exports = {
    get: () => {
        return status;
    },
    monitor: monitor
}