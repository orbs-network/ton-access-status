const sendMessageToTelegram = require('./telegram')
const ConfigUpdater = require('./configUpdater');

///////////////////////////////////////////
class Alert {
    constructor() {
        // init empty across All Nodes status
        this.protonetAcrossAllNodes = {}
        this.consistMngrNodes = -1; // uninitialized


        // update config
        this.configUpdater = this.configUpdater = new ConfigUpdater();
        this.updateConfig();
    }
    status() {
        // count alerts
        let count = 0;
        for (const protonet in this.protonetAcrossAllNodes) {
            if (!this.protonetAcrossAllNodes[protonet])
                count++;
        }
        let res = {
            count: count,
            protonetAcrossAllNodes: Object.assign({}, this.protonetAcrossAllNodes)
        }

        if (!this.consistMngrNodes) {
            res.count += 1; // to trigger UI
            res.consistMngrNodesMsg = "\u{1F6A8} /node/mngr is NOT consistant on all nodes!"
        }
        return res;
    }
    //////////////////////////////////////////////////
    async updateConfig() {
        await this.configUpdater.updateLiveConfig('https://ton-blockchain.github.io/testnet-global.config.json', 'live-testnet.json');
        await this.configUpdater.updateLiveConfig('https://ton-blockchain.github.io/global.config.json', 'live-mainnet.json');
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
        return health ? true : false;
    }
    ///////////////////////////////////////////
    async checkProtonetAccross(benchmark, data) {
        let changed = false;
        let needUpdate = false;
        // ceck protonet inactive across all nodes
        for (const protonet in benchmark) {
            const healthy = this.checkHealthProtonet(data.nodes, protonet);
            // create entry for protonet if 
            if (!this.protonetAcrossAllNodes.hasOwnProperty(protonet)) {
                this.protonetAcrossAllNodes[protonet] = null;
            }
            // send GOOD/BAD message only upon change
            if (healthy !== this.protonetAcrossAllNodes[protonet]) {
                // update entry
                this.protonetAcrossAllNodes[protonet] = healthy;
                // return value
                changed = true;

                // generate update of config files if one protonet is not healthy
                if (!needUpdate)
                    needUpdate = !healthy;

                // send alert                
                const icon = healthy ? '\u2705' : '\u{1F6A8}';
                const msg = `${icon} ${protonet} is ${healthy ? '' : 'not'} healthy on ${healthy ? 'one or more' : 'all'} nodes!`;
                if (!healthy) {
                    console.error(msg);
                }
                await sendMessageToTelegram(msg);
            }
        }
        // update config files if not heakty
        if (needUpdate)
            await this.updateConfig();

        return changed;
    }
    ///////////////////////////////////////////
    cmpNodesApi(a, b) {
        if (a.status !== b.status)
            return false;
        if (a.resp.length !== b.resp.length)
            return false;

        for (let i = 0; i < a.resp.length; ++i) {
            if (a.resp[i].NodeId !== b.resp[i].NodeId)
                return false;
            if (a.resp[i].BackendName !== b.resp[i].BackendName)
                return false;
            if (a.resp[i].Ip !== b.resp[i].Ip)
                return false;
            if (a.resp[i].Weight !== b.resp[i].Weight)
                return false;
            // not topology related- might get inconsistent depends on mngr check timing               
            //if (a.resp[i].Healthy !== b.resp[i].Healthy)
            //return false;
        }
        return true;
    }

    ///////////////////////////////////////////
    async checkConsistNodesApi(nodes) {
        const nodesApi = nodes[0].mngr.nodesApi;
        let consist = true;
        for (let i = 1; i < nodes.length && consist; ++i) {
            consist = consist && this.cmpNodesApi(nodesApi, nodes[i].mngr.nodesApi);
        }

        // if changed
        if (this.consistMngrNodes !== consist) {
            this.consistMngrNodes = consist;

            // send alert                
            const icon = consist ? '\u2705' : '\u{1F6A8}';
            const msg = `${icon} /node/mngr is ${consist ? '' : 'not'} consistant on ${consist ? 'all' : 'one or more'} nodes!`;
            if (!consist) {
                console.error(msg);
            }
            await sendMessageToTelegram(msg);
        }

    }
}

module.exports = Alert;