import { evmMoleculaTokenAddresses, evmStaticTokenAddresses } from '../addresses';

import { EVMChainIDs } from '../chains';

import type { PoolCurrency, ThirdPartyPoolCurrency } from '../currencies';

import type { PoolData } from './types';

// Testnet

/**
 * Static Pool Currencies addresses for Retail for Testnet.
 */
export const staticPoolCurrenciesRetailTestnet = {
    USDT: {
        token: evmStaticTokenAddresses.USDT[EVMChainIDs.Sepolia],
        n: 12,
    },
    USDC: {
        token: evmStaticTokenAddresses.USDC[EVMChainIDs.Sepolia],
        n: 12,
    },
    DAI: {
        token: evmStaticTokenAddresses.DAI[EVMChainIDs.Sepolia],
        n: 0,
    },
    USDe: {
        token: evmStaticTokenAddresses.USDe[EVMChainIDs.Sepolia],
        n: 0,
    },
    aEthUSDT: {
        token: evmStaticTokenAddresses.aEthUSDT[EVMChainIDs.Sepolia],
        n: 12,
    },
    aEthUSDC: {
        token: evmStaticTokenAddresses.aEthUSDC[EVMChainIDs.Sepolia],
        n: 12,
    },
    aEthDAI: {
        token: evmStaticTokenAddresses.aEthDAI[EVMChainIDs.Sepolia],
        n: 0,
    },
} satisfies { [token in ThirdPartyPoolCurrency]?: PoolData };

/**
 * Pool Currencies addresses for Retail for Testnet.
 */
export const poolCurrenciesRetailTestnet = {
    ...staticPoolCurrenciesRetailTestnet,
    mUSDe: {
        token: evmMoleculaTokenAddresses.mUSDe[EVMChainIDs.Sepolia],
        n: 0,
    },
    sUSDe: {
        token: evmStaticTokenAddresses.sUSDe[EVMChainIDs.Sepolia],
        n: 0,
    },
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * A type annotation for ERC-20 tokens which can be used by Pool Keeper in Retail Testnet.
 */
export type PoolsTokensRetailTestnet = keyof typeof poolCurrenciesRetailTestnet;

// Mainnet

/**
 * Static Pool Currencies addresses for Retail for Mainnet.
 */
export const staticPoolCurrenciesRetailMainnet = {
    DAI: {
        token: evmStaticTokenAddresses.DAI[EVMChainIDs.Mainnet],
        n: 0,
    },
    sDAI: {
        token: evmStaticTokenAddresses.sDAI[EVMChainIDs.Mainnet],
        n: 0,
    },
    USDT: {
        token: evmStaticTokenAddresses.USDT[EVMChainIDs.Mainnet],
        n: 12,
    },
    USDC: {
        token: evmStaticTokenAddresses.USDC[EVMChainIDs.Mainnet],
        n: 12,
    },
    spDAI: {
        token: evmStaticTokenAddresses.spDAI[EVMChainIDs.Mainnet],
        n: 0,
    },
    USDe: {
        token: evmStaticTokenAddresses.USDe[EVMChainIDs.Mainnet],
        n: 0,
    },
    sUSDe: {
        token: evmStaticTokenAddresses.sUSDe[EVMChainIDs.Mainnet],
        n: 0,
    },
    aEthUSDT: {
        token: evmStaticTokenAddresses.aEthUSDT[EVMChainIDs.Mainnet],
        n: 12,
    },
    aEthUSDC: {
        token: evmStaticTokenAddresses.aEthUSDC[EVMChainIDs.Mainnet],
        n: 12,
    },
    aEthDAI: {
        token: evmStaticTokenAddresses.aEthDAI[EVMChainIDs.Mainnet],
        n: 0,
    },
    FRAX: {
        token: evmStaticTokenAddresses.FRAX[EVMChainIDs.Mainnet],
        n: 0,
    },
    sFRAX: {
        token: evmStaticTokenAddresses.sFRAX[EVMChainIDs.Mainnet],
        n: 0,
    },
    frxUSD: {
        token: evmStaticTokenAddresses.frxUSD[EVMChainIDs.Mainnet],
        n: 0,
    },
    sFrxUSD: {
        token: evmStaticTokenAddresses.sFrxUSD[EVMChainIDs.Mainnet],
        n: 0,
    },
    USDS: {
        token: evmStaticTokenAddresses.USDS[EVMChainIDs.Mainnet],
        n: 0,
    },
    sUSDS: {
        token: evmStaticTokenAddresses.sUSDS[EVMChainIDs.Mainnet],
        n: 0,
    },
} satisfies { [token in ThirdPartyPoolCurrency]?: PoolData };

/**
 * Pool Currencies addresses for Retail for Mainnet (prod).
 */
export const poolCurrenciesRetailMainnetProd = {
    ...staticPoolCurrenciesRetailMainnet,

    mUSDe: {
        token: evmMoleculaTokenAddresses.mUSDe[EVMChainIDs.Mainnet].prod,
        n: 0,
    },
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * Poo Currencies addresses for Retail for Mainnet (beta).
 */
export const poolCurrenciesRetailMainnetBeta = {
    ...staticPoolCurrenciesRetailMainnet,

    mUSDe: {
        token: evmMoleculaTokenAddresses.mUSDe[EVMChainIDs.Mainnet].beta,
        n: 0,
    },
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * A type annotation for all ERC-20 tokens which can be used in MoleculaPool
 * for Retail solution in Mainnet.
 */
export type PoolsTokensRetailMainnet =
    | keyof typeof poolCurrenciesRetailMainnetProd
    | keyof typeof poolCurrenciesRetailMainnetBeta;

/**
 * A type annotation for third-party ERC-20 tokens which can be used in MoleculaPool
 * for Retail solution in all networks.
 */
export type RetailThirdPartyPoolCurrency =
    | keyof typeof staticPoolCurrenciesRetailMainnet
    | keyof typeof staticPoolCurrenciesRetailTestnet;

/**
 * A type annotation for molecula tokens which can be used in MoleculaPool
 * for Retail solution in all networks.
 */
export type RetailMoleculaPoolCurrency = Extract<keyof typeof evmMoleculaTokenAddresses, 'mUSDe'>;

/**
 * A type annotation for the union of third-party tokens and Molecula tokens for Retail solutions
 */
export type RetailPoolCurrency = RetailThirdPartyPoolCurrency | RetailMoleculaPoolCurrency;
