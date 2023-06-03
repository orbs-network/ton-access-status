const { LiteClient, LiteSingleEngine } = require('ton-lite-client');
const axios = require('axios');
const AWS = require('aws-sdk');
const crypto = require('crypto');

class ConfigUpdater {
  constructor() {
    this.previousHash = {};
  }

  static int32ToIp(num) {
    return (num >>> 24 & 0xFF) + '.' +
      (num >>> 16 & 0xFF) + '.' +
      (num >>> 8 & 0xFF) + '.' +
      (num & 0xFF);
  }

  static async downloadJsonFile(url) {
    try {
      const response = await axios.get(url);
      const jsonData = response.data;

      // Parse the JSON data into an object
      const jsonObject = JSON.parse(JSON.stringify(jsonData));

      return jsonObject;
    } catch (error) {
      console.error('Error downloading or parsing the JSON file:', error);
      throw error;
    }
  }

  static calculateHash(jsonData) {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(jsonData));
    return hash.digest('hex');
  }

  static async uploadJsonToS3(jsonData, fileName, bucketName) {
    try {
      // Configure the AWS SDK with your credentials and desired region
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: 'us-east-1'
      });

      const s3 = new AWS.S3();

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: JSON.stringify(jsonData),
        ContentType: 'application/json'
      };

      const uploadResult = await s3.upload(params).promise();

      console.log('JSON file uploaded successfully:', uploadResult.Location);
      return uploadResult.Location;
    } catch (error) {
      console.error('Error uploading JSON file to S3:', error);
      throw error;
    }
  }
  // force create new config live files
  // called upon alert by status
  resetCache() {
    this.previousHash = {};
  }
  async updateLiveConfig(url, targetFileName) {
    // download config
    const config = await ConfigUpdater.downloadJsonFile(url);

    // no liteservers found
    if (!config.liteservers?.length) {
      console.error(`no liteservers were found in ${url}`);
      return;
    }

    // calculate the hash of the current JSON
    const currentHash = ConfigUpdater.calculateHash(config);

    // retrieve the stored hash from the previous call (e.g., from a database or S3)
    if (!this.previousHash[url]) {
      this.previousHash[url] = '';
    }

    // compare the current and previous hashes
    if (currentHash === this.previousHash[url]) {
      //console.log(`JSON file has not changed since the previous call ${url}`);
      return;
    }
    console.log(`JSON file changed in ${url}`);
    console.log('start checking litesevers...');

    // keep previous hash
    this.previousHash[url] = currentHash;

    // filter out non-working liteservers
    const liveSrvs = [];
    for (const srv of config.liteservers) {
      try {
        let engine = new LiteSingleEngine({ host: ConfigUpdater.int32ToIp(srv.ip), port: srv.port, publicKey: Buffer.from(srv.id.key, 'base64') });
        const client = new LiteClient({ engine, batchSize: 10 });
        const working = await client.getMasterchainInfo().catch(e => {
          console.error(e);
        });
        if (working.kind) {
          liveSrvs.push(srv);
        }
      } catch (e) {
        console.error('server not working', srv);
      }
    }
    if (!liveSrvs.length) {
      console.log(JSON.stringify(config.liteservers, null, 2));
      console.error(`no online liteservers were found in the list`);
      return;
    }

    // replace liteservers with online ones
    config.liteservers = liveSrvs;

    // upload to S3
    await ConfigUpdater.uploadJsonToS3(config, targetFileName, 'orbs-ton-gateway');
  }
}

// Usage:
// ConfigUpdater.updateLiveConfig('https://ton-blockchain.github.io/testnet-global.config.json', 'live-testnet.json');

module.exports = ConfigUpdater;
