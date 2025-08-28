import { evmStaticTokenAddresses, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from './metaEthTypes';

/** Ethereum Mainnet config for prod. */
export const metaEthMainnetProdConfig: MetaEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on Ethereum Mainnet. */
    WETH_ADDRESS: evmStaticTokenAddresses.wETH[EVMChainIDs.Mainnet],

    /** Lido LRT Token address on Ethereum Mainnet. */
    STETH_ADDRESS: evmStaticTokenAddresses.stETH[EVMChainIDs.Mainnet],

    /** Owner address. Must specify it before the deployment. */
    META_OWNER: '0x',

    /** Pool keeper address. Must specify it before the deployment. */
    META_POOL_KEEPER: '0x',

    /** Guardian address that can pause MetaPoolTreasury contract. Must specify it before the deployment */
    META_GUARDIAN: '0x',

    /** (META_APY / 10_000) * 100% is the percentage of revenue retained by all molecula token holders. */
    META_APY: 8_000,

    /** MetaETH token name. */
    META_TOKEN_NAME: 'MetaETH',

    /** MetaETH token symbol. */
    META_TOKEN_SYMBOL: 'METH',

    /** MetaETH token decimals. */
    META_TOKEN_DECIMALS: 18,

    /** Minimal deposit in eth */
    META_MIN_DEPOSIT_ETH: 10n ** 15n,

    /** Minimal redeem in shares */
    META_MIN_REDEEM_SHARES: 5n * 10n ** 14n,
};
