import { ethers } from 'ethers';

import { evmStaticTokenAddresses, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from './metaEthTypes';

/** Sepolia config. */
export const metaEthSepoliaConfig: MetaEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address. */
    wETH: evmStaticTokenAddresses.wETH[EVMChainIDs.Sepolia],

    /** Lido LRT token address. */
    stETH: evmStaticTokenAddresses.stETH[EVMChainIDs.Sepolia],

    /** Wrapped eETH (weETH) token address. */
    weETH: '0x',

    /** Kelp DAO Restaked ETH (rsETH) */
    rsETH: '0x',

    /** Renzo Restaked ETH (ezETH) */
    ezETH: '0x',

    /** Owner address. Must specify it before the deployment. */
    OWNER: '0xd4e9c83EA2f1571311246920e2B1a670a8a3080A',

    /** Pool keeper address. Must specify it before the deployment. */
    POOL_KEEPER: '0x51fFFb7a28734D7Abb70a30012ce86646E39E269',

    /** Yield distributor in supply manager. Currently, it is equal to pool keeper */
    YIELD_DISTRIBUTOR: '0x51fFFb7a28734D7Abb70a30012ce86646E39E269',

    /** Guardian address that can pause MetaPoolTreasury contract. Must specify it before the deployment */
    GUARDIAN: '0xd4e9c83EA2f1571311246920e2B1a670a8a3080A',

    /** (META_APY / 10_000) * 100% is the percentage of revenue retained by all molecula token holders. */
    APY: 8_000,

    /** MetaETH token name. */
    META_ETH_TOKEN_NAME: 'MetaETH test v0.1',

    /** MetaETH token symbol. */
    META_ETH_TOKEN_SYMBOL: 'METHt',

    /** MetaETH token decimals. */
    META_ETH_TOKEN_DECIMALS: 18,

    /** wmetaETH token name. */
    WMETA_ETH_TOKEN_NAME: 'Wrapped MetaETH test v0.1',

    /** wmetaETH token symbol. */
    WMETA_ETH_TOKEN_SYMBOL: 'wMETHtv0.1',

    /** Minimal deposit in ETH */
    MIN_DEPOSIT_ETH: ethers.parseEther('0.001'),

    /** Minimal deposit in weETH */
    MIN_DEPOSIT_weETH: ethers.parseEther('0.00107'),

    /** Minimal deposit in ezETH */
    MIN_DEPOSIT_ezETH: ethers.parseEther('0.00105'),

    /** Minimal deposit in rsETH */
    MIN_DEPOSIT_rsETH: ethers.parseEther('0.00104'),

    /** Minimal redeem in shares */
    MIN_REDEEM_SHARES: ethers.parseEther('0.0005'),
};
