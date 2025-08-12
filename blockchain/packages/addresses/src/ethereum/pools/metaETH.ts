import { evmStaticTokenAddresses } from '../addresses';

import { EVMChainIDs } from '../chains';

import type { PoolCurrency, ThirdPartyPoolCurrency } from '../currencies';

import type { PoolData } from './types';

// Testnet

/**
 * Static Pool Currencies addresses for MetaETH for Testnet.
 */
export const staticPoolCurrenciesMetaETHTestnet = {
    ETH: {
        token: evmStaticTokenAddresses.ETH[EVMChainIDs.Sepolia],
        n: 0,
    },
    stETH: {
        token: evmStaticTokenAddresses.stETH[EVMChainIDs.Sepolia],
        n: 0,
    },
    wETH: {
        token: evmStaticTokenAddresses.wETH[EVMChainIDs.Sepolia],
        n: 0,
    },
} satisfies { [token in ThirdPartyPoolCurrency]?: PoolData };

/**
 * Pool Currencies addresses for MetaETH for Testnet.
 */
export const poolCurrenciesMetaETHTestnet = {
    ...staticPoolCurrenciesMetaETHTestnet,
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * A type annotation for ERC-20 tokens which can be used in MoleculaPool
 * for MetaETH solution in Testnet.
 */
export type PoolsTokensMetaETHTestnet = keyof typeof poolCurrenciesMetaETHTestnet;

// Mainnet

/**
 * Static Pool Currencies addresses for MetaETH for Mainnet.
 */
export const staticPoolCurrenciesMetaETHMainnet = {
    ETH: {
        token: evmStaticTokenAddresses.ETH[EVMChainIDs.Mainnet],
        n: 0,
    },
    stETH: {
        token: evmStaticTokenAddresses.stETH[EVMChainIDs.Mainnet],
        n: 0,
    },
    wETH: {
        token: evmStaticTokenAddresses.wETH[EVMChainIDs.Mainnet],
        n: 0,
    },
} satisfies { [token in ThirdPartyPoolCurrency]?: PoolData };

/**
 * Pool Currencies addresses for MetaETH for Mainnet (prod).
 */
export const poolCurrenciesMetaETHMainnetProd = {
    ...staticPoolCurrenciesMetaETHMainnet,
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * Pool Currencies addresses for MetaETH for Mainnet (beta).
 */
export const poolCurrenciesMetaETHMainnetBeta = {
    ...staticPoolCurrenciesMetaETHMainnet,
} satisfies { [token in PoolCurrency]?: PoolData };

/**
 * A type annotation for all ERC-20 tokens which can be used in MoleculaPool
 * for MetaETH solution in Mainnet.
 */
export type MetaETHPoolCurrency =
    | keyof typeof poolCurrenciesMetaETHMainnetProd
    | keyof typeof poolCurrenciesMetaETHMainnetBeta;

/**
 * A type annotation for third-party ERC-20 tokens which can be used in MoleculaPool
 * for MetaETH solution in all networks.
 */
export type MetaETHThirdPartyPoolCurrency =
    | keyof typeof staticPoolCurrenciesMetaETHMainnet
    | keyof typeof staticPoolCurrenciesMetaETHTestnet;
