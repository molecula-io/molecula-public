import { ethers } from 'ethers';

import { evmStaticTokenAddresses, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from './metaEthTypes';

/** Ethereum Mainnet config for beta. */
export const metaEthMainnetBetaConfig: MetaEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on Ethereum Mainnet. */
    wETH: evmStaticTokenAddresses.wETH[EVMChainIDs.Mainnet],

    /** Lido LRT Token address on Ethereum Mainnet. */
    stETH: evmStaticTokenAddresses.stETH[EVMChainIDs.Mainnet],

    /** Wrapped eETH (weETH) token address. */
    weETH: evmStaticTokenAddresses.weETH[EVMChainIDs.Mainnet],

    /** Kelp DAO Restaked ETH (rsETH) */
    rsETH: evmStaticTokenAddresses.rsETH[EVMChainIDs.Mainnet],

    /** Renzo Restaked ETH (ezETH) */
    ezETH: evmStaticTokenAddresses.ezETH[EVMChainIDs.Mainnet],

    /** Owner address. Must specify it before the deployment. */
    OWNER: '0x',

    /** Pool keeper address. Must specify it before the deployment. */
    POOL_KEEPER: '0x',

    /** Yield distributor in supply manager. */
    YIELD_DISTRIBUTOR: '0x',

    /** Guardian address that can pause MetaPoolTreasury contract. Must specify it before the deployment */
    GUARDIAN: '0x',

    /** (META_APY / 10_000) * 100% is the percentage of revenue retained by all molecula token holders. */
    APY: 8_000,

    /** MetaETH token name. */
    META_ETH_TOKEN_NAME: 'MetaETH release candidate',

    /** MetaETH token symbol. */
    META_ETH_TOKEN_SYMBOL: 'METHrc',

    /** MetaETH token decimals. */
    META_ETH_TOKEN_DECIMALS: 18,

    /** wmetaETH token name. */
    WMETA_ETH_TOKEN_NAME: 'Wrapped MetaETH release candidate',

    /** wmetaETH token symbol. */
    WMETA_ETH_TOKEN_SYMBOL: 'wMETHrc',

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
