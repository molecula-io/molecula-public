/* eslint-disable import/no-extraneous-dependencies */
import * as dotenv from 'dotenv';
import type { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import '@fireblocks/hardhat-fireblocks';
import './extensions/hardhat-tronweb';

import './tasks';
import { tronMainnetProdConfig } from './configs/tron/mainnetProdTyped';
import { shastaConfig } from './configs/tron/shastaTyped';

dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.config.env' });
dotenv.config({ path: '.env.fireblocks.testnet' });

const config: HardhatUserConfig = {
    paths: {
        sources: './contracts',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.30', // using in evm contracts
                settings: {
                    evmVersion: 'prague',
                    optimizer: {
                        enabled: true,
                        runs: 400,
                    },
                },
            },
            {
                version: '0.8.24', // used for contracts targeting the Tron network
                settings: {
                    evmVersion: 'cancun',
                    optimizer: {
                        enabled: true,
                        runs: 400,
                    },
                },
            },
            {
                version: '0.4.18', // using in mock tether token contracts
                settings: {
                    evmVersion: 'byzantium',
                },
            },
            {
                version: '0.4.20', // using in mock tether token contracts
                settings: {
                    evmVersion: 'byzantium',
                },
            },
        ],
        overrides: {
            'contracts/solutions/Carbon/common/UsdtOFT.sol': {
                version: '0.8.22',
                settings: {
                    evmVersion: 'shanghai',
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        },
    },
    networks: {
        hardhat: {
            gasPrice: 40_000_000_000,
            ...(process.env.JSON_RPC_URL &&
                process.env.FORK_BLOCK_NUMBER && {
                    forking: {
                        url: process.env.JSON_RPC_URL,
                        blockNumber: parseInt(process.env.FORK_BLOCK_NUMBER, 10),
                    },
                }),
        },
        ...(process.env.JSON_RPC_URL_SEPOLIA &&
            process.env.ETHEREUM_SEED_PHRASE && {
                sepolia: {
                    url: process.env.JSON_RPC_URL_SEPOLIA,
                    accounts: {
                        mnemonic: process.env.ETHEREUM_SEED_PHRASE,
                        path: "m/44'/60'/0'/0",
                        initialIndex: 0,
                        count: 20,
                        passphrase: '',
                    },
                },
            }),
        ...(process.env.JSON_RPC_URL_SEPOLIA &&
            process.env.FIREBLOCKS_API_KEY &&
            process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH && {
                sepolia_fireblocks: {
                    url: process.env.JSON_RPC_URL_SEPOLIA,
                    fireblocks: {
                        privateKey: process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH,
                        apiKey: process.env.FIREBLOCKS_API_KEY,
                        vaultAccountIds: [1, 2],
                        logRequestsAndResponses: true,
                        logTransactionStatusChanges: true,
                    },
                },
            }),
        ...(process.env.ETHEREUM_SEED_PHRASE && {
            holesky: {
                url: 'https://1rpc.io/holesky', // public rpc no need to store in env
                accounts: {
                    mnemonic: process.env.ETHEREUM_SEED_PHRASE,
                    path: "m/44'/60'/0'/0",
                    initialIndex: 0,
                    count: 20,
                    passphrase: '',
                },
            },
        }),
        ...(process.env.ETHEREUM_SEED_PHRASE && {
            hoodi: {
                url: 'https://0xrpc.io/hoodi', // public rpc no need to store in env
                accounts: {
                    mnemonic: process.env.ETHEREUM_SEED_PHRASE,
                    path: "m/44'/60'/0'/0",
                    initialIndex: 0,
                    count: 20,
                    passphrase: '',
                },
            },
        }),
        ...(process.env.JSON_RPC_URL &&
            process.env.ETHEREUM_SEED_PHRASE && {
                ethereum: {
                    url: process.env.JSON_RPC_URL,
                    accounts: {
                        mnemonic: process.env.ETHEREUM_SEED_PHRASE,
                        path: "m/44'/60'/0'/0",
                        initialIndex: 0,
                        count: 20,
                        passphrase: '',
                    },
                },
            }),
        ...(process.env.TRON_SEED_PHRASE && {
            shasta: {
                url: shastaConfig.RPC_URL,
                accounts: {
                    mnemonic: process.env.TRON_SEED_PHRASE,
                    path: "m/44'/195'/0'/0/0",
                    initialIndex: 0,
                    count: 20,
                    passphrase: '',
                },
            },
        }),
        ...(process.env.TRON_SEED_PHRASE && {
            tron: {
                url: tronMainnetProdConfig.RPC_URL,
                accounts: {
                    mnemonic: process.env.TRON_SEED_PHRASE,
                    path: "m/44'/195'/0'/0/0",
                    initialIndex: 0,
                    count: 20,
                    passphrase: '',
                },
            },
        }),
    },
    ...(process.env.ETHEREUM_API_KEY && {
        etherscan: {
            apiKey: {
                sepolia: process.env.ETHEREUM_API_KEY,
                ethereum: process.env.ETHEREUM_API_KEY,
                holesky: process.env.ETHEREUM_API_KEY,
                hoodi: process.env.ETHEREUM_API_KEY,
            },
            customChains: [
                // hoodi is not in the default hardhat chains
                {
                    network: 'hoodi',
                    chainId: 560048,
                    urls: {
                        apiURL: 'https://api-hoodi.etherscan.io/api',
                        browserURL: 'https://hoodi.etherscan.io',
                    },
                },
            ],
        },
    }),

    mocha: {
        timeout: 10 * 60 * 1000, // 10 min
    },
    gasReporter: {
        outputFile: 'gas-usage.txt',
        gasPrice: 1.75, // in Gwei
        currency: 'USD',
        tokenPrice: '2637', // 2637 usd/eth
    },
};

export default config;
