const sendMessageToTelegram = require('./telegram')
const ConfigUpdater = require('./configUpdater');

///////////////////////////////////////////
class Alert {
    constructor() {
        // init empty across All Nodes status
        this.protonetAcrossAllNodes = {}

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
        return {
            count: count,
            protonetAcrossAllNodes: Object.assign({}, this.protonetAcrossAllNodes)
        }
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
    async check(benchmark, data) {
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
}

module.exports = Alert;