import { evmStaticTokenAddresses, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from './metaEthTypes';

/** Sepolia config. */
export const metaEthSepoliaConfig: MetaEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on Ethereum Mainnet. */
    WETH_ADDRESS: evmStaticTokenAddresses.wETH[EVMChainIDs.Sepolia],

    /** Lido LRT Token address on Ethereum Mainnet. */
    STETH_ADDRESS: evmStaticTokenAddresses.stETH[EVMChainIDs.Sepolia],

    /** Owner address. Must specify it before the deployment. */
    META_OWNER: '0xd4e9c83EA2f1571311246920e2B1a670a8a3080A',

    /** Pool keeper address. Must specify it before the deployment. */
    META_POOL_KEEPER: '0x51fFFb7a28734D7Abb70a30012ce86646E39E269',

    /** Guardian address that can pause MetaPoolTreasury contract. Must specify it before the deployment */
    META_GUARDIAN: '0xd4e9c83EA2f1571311246920e2B1a670a8a3080A',

    /** (META_APY / 10_000) * 100% is the percentage of revenue retained by all molecula token holders. */
    META_APY: 8_000,

    /** MetaETH token name. */
    META_TOKEN_NAME: 'MetaETH test v0.1',

    /** MetaETH token symbol. */
    META_TOKEN_SYMBOL: 'METHt',

    /** MetaETH token decimals. */
    META_TOKEN_DECIMALS: 18,

    /** Minimal deposit in eth */
    META_MIN_DEPOSIT_ETH: 10n ** 15n,

    /** Minimal redeem in shares */
    META_MIN_REDEEM_SHARES: 5n * 10n ** 14n,
};
