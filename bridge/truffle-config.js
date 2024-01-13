const HDWalletProvider = require('@truffle/hdwallet-provider');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*'
    },
    sepolia: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.ADMIN_PK],
          providerOrUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
        }),
      network_id: 11155111
    },
    mumbai: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.ADMIN_PK],
          providerOrUrl: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`
        }),
      network_id: 80001
    }
  },
  compilers: {
    solc: {
      version: '0.8.13',
      settings: {
        optimizer: {
          enabled: false,
          runs: 200
        }
      }
    }
  }
};
