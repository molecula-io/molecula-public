import {
    DevnetContractsCarbon,
    DevnetContractsNitrogen,
    DevnetContractsMetaEth,
    MainBetaContractsCarbon,
    MainBetaContractsNitrogen,
    MainBetaContractsMetaEth,
    DevnetContractsEthena,
} from '../../deploy';

import {
    MainProdContractsCarbon,
    MainProdContractsNitrogen,
    MainProdContractsMetaEth,
} from '../../deploy/mainnet/prod';

import { EVMChainIDs } from './chains';

import type { EVMAddress } from './types';

/**
 * Supported EVM token static addresses.
 */
export const evmStaticTokenAddresses = {
    USDT: {
        [EVMChainIDs.Mainnet]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        [EVMChainIDs.Sepolia]: '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0',
    },
    DAI: {
        [EVMChainIDs.Mainnet]: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        [EVMChainIDs.Sepolia]: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
    },
    sDAI: {
        [EVMChainIDs.Mainnet]: '0x83f20f44975d03b1b09e64809b757c47f942beea',
        [EVMChainIDs.Sepolia]: undefined,
    },
    spDAI: {
        [EVMChainIDs.Mainnet]: '0x4DEDf26112B3Ec8eC46e7E31EA5e123490B05B8B',
        [EVMChainIDs.Sepolia]: undefined,
    },
    USDe: {
        [EVMChainIDs.Mainnet]: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
        [EVMChainIDs.Sepolia]: DevnetContractsEthena.USDe as EVMAddress,
    },
    sUSDe: {
        [EVMChainIDs.Mainnet]: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
        [EVMChainIDs.Sepolia]: DevnetContractsEthena.sUSDe as EVMAddress,
    },
    aEthUSDT: {
        [EVMChainIDs.Mainnet]: '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a',
        [EVMChainIDs.Sepolia]: '0xAF0F6e8b0Dc5c913bbF4d14c22B4E78Dd14310B6',
    },
    aEthUSDC: {
        [EVMChainIDs.Mainnet]: '0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c',
        [EVMChainIDs.Sepolia]: '0x16dA4541aD1807f4443d92D26044C1147406EB80',
    },
    aEthDAI: {
        [EVMChainIDs.Mainnet]: '0x018008bfb33d285247a21d44e50697654f754e63',
        [EVMChainIDs.Sepolia]: '0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8',
    },
    sFRAX: {
        [EVMChainIDs.Mainnet]: '0xa663b02cf0a4b149d2ad41910cb81e23e1c41c32',
        [EVMChainIDs.Sepolia]: undefined,
    },
    FRAX: {
        [EVMChainIDs.Mainnet]: '0x853d955acef822db058eb8505911ed77f175b99e',
        [EVMChainIDs.Sepolia]: undefined,
    },
    frxUSD: {
        [EVMChainIDs.Mainnet]: '0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29',
        [EVMChainIDs.Sepolia]: undefined,
    },
    sFrxUSD: {
        [EVMChainIDs.Mainnet]: '0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6',
        [EVMChainIDs.Sepolia]: undefined,
    },
    USDC: {
        [EVMChainIDs.Mainnet]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        [EVMChainIDs.Sepolia]: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
    },
    USDS: {
        [EVMChainIDs.Mainnet]: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
        [EVMChainIDs.Sepolia]: undefined,
    },
    sUSDS: {
        [EVMChainIDs.Mainnet]: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
        [EVMChainIDs.Sepolia]: undefined,
    },
    ETH: {
        // See: https://eips.ethereum.org/EIPS/eip-7528
        [EVMChainIDs.Mainnet]: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        [EVMChainIDs.Sepolia]: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    },
    stETH: {
        [EVMChainIDs.Mainnet]: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        [EVMChainIDs.Sepolia]: '0x00c71b0fCadE911B2feeE9912DE4Fe19eB04ca56',
    },
    wETH: {
        [EVMChainIDs.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        [EVMChainIDs.Sepolia]: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
    },
} as const;

/**
 * Custom EVM tokens developed exclusively for MoleculaPool.
 */
export const evmMoleculaTokenAddresses = {
    mUSDe: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.mUSDe as EVMAddress,
            prod: MainProdContractsNitrogen.eth.mUSDe as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.mUSDe as EVMAddress,
    },
} as const;

/**
 * Supported EVM static contract addresses.
 */
export const evmStaticContractAddresses = {
    SparkPool: {
        [EVMChainIDs.Mainnet]: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
        [EVMChainIDs.Sepolia]: undefined,
    },
    AavePool: {
        [EVMChainIDs.Mainnet]: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        [EVMChainIDs.Sepolia]: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
    },
} as const;

/**
 * Supported EVM molecula contract addresses.
 */
export const evmMoleculaContractAddresses = {
    // mUSD / Retail (Nitrogen)

    RetailSupplyManager: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.supplyManager as EVMAddress,
            prod: MainProdContractsNitrogen.eth.supplyManager as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.supplyManager as EVMAddress,
    },
    PoolKeeper: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.poolKeeper as EVMAddress,
            prod: MainProdContractsNitrogen.eth.poolKeeper as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.poolKeeper as EVMAddress,
    },
    MoleculaPoolTreasury: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.moleculaPool as EVMAddress,
            prod: MainProdContractsNitrogen.eth.moleculaPool as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.moleculaPool as EVMAddress,
    },
    AccountantAgent: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.accountantAgent as EVMAddress,
            prod: MainProdContractsNitrogen.eth.accountantAgent as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.accountantAgent as EVMAddress,
    },
    RebaseToken: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.rebaseToken as EVMAddress,
            prod: MainProdContractsNitrogen.eth.rebaseToken as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.rebaseToken as EVMAddress,
    },
    MUSDLock: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsNitrogen.eth.mUSDLock as EVMAddress,
            prod: MainProdContractsNitrogen.eth.mUSDLock as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsNitrogen.eth.mUSDLock as EVMAddress,
    },
    AgentLZ: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsCarbon.eth.agentLZ as EVMAddress,
            prod: MainProdContractsCarbon.eth.agentLZ as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsCarbon.eth.agentLZ as EVMAddress,
    },

    // MetaETH

    MetaETH: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsMetaEth.eth.rebaseTokenV2 as EVMAddress,
            prod: MainProdContractsMetaEth.eth.rebaseTokenV2 as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsMetaEth.eth.rebaseTokenV2 as EVMAddress,
    },
    MetaETHSupplyManager: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsMetaEth.eth.supplyManagerV2 as EVMAddress,
            prod: MainProdContractsMetaEth.eth.supplyManagerV2 as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsMetaEth.eth.supplyManagerV2 as EVMAddress,
    },
    MetaETHNativeTokenVault: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsMetaEth.eth.nativeTokenVault as EVMAddress,
            prod: MainProdContractsMetaEth.eth.nativeTokenVault as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsMetaEth.eth.nativeTokenVault as EVMAddress,
    },
    MetaETHStETHTokenVault: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsMetaEth.eth.stETHVault as EVMAddress,
            prod: MainProdContractsMetaEth.eth.stETHVault as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsMetaEth.eth.stETHVault as EVMAddress,
    },
    MetaETHWETHTokenVault: {
        [EVMChainIDs.Mainnet]: {
            beta: MainBetaContractsMetaEth.eth.wETHVault as EVMAddress,
            prod: MainProdContractsMetaEth.eth.wETHVault as EVMAddress,
        },
        [EVMChainIDs.Sepolia]: DevnetContractsMetaEth.eth.wETHVault as EVMAddress,
    },
} as const;
