/* eslint-disable import/no-extraneous-dependencies */
import * as dotenv from 'dotenv';
import type { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-gas-reporter';

import './tasks';

dotenv.config({ path: '.env.test' });

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.28',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 20_000,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            gasPrice: 40_000_000_000,
            forking: {
                url: process.env.JSON_RPC_URL as string,
                blockNumber: 21772906,
            },
        },
        sepolia: {
            url: process.env.JSON_RPC_URL_SEPOLIA as string,
            accounts: {
                mnemonic: process.env.ETHEREUM_SEED_PHRASE as string,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
                passphrase: '',
            },
        },
    },
    mocha: {
        timeout: 10 * 60 * 1000, // 10 min
    },
};

export default config;
