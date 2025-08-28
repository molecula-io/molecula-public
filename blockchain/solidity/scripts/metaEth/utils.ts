/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import {
    metaEthMainnetBetaConfig,
    metaEthMainnetProdConfig,
    metaEthSepoliaConfig,
} from '../../configs';

export function getMetaEthEnvironmentConfig(network: EnvironmentType) {
    switch (network) {
        case EnvironmentType['mainnet/beta']:
            return metaEthMainnetBetaConfig;
        case EnvironmentType['mainnet/prod']:
            return metaEthMainnetProdConfig;
        case EnvironmentType.devnet:
            return metaEthSepoliaConfig;
        default:
            throw new Error('Unsupported network type!');
    }
}

export async function getMetaEthConfig(hre: HardhatRuntimeEnvironment, network: EnvironmentType) {
    const config = getMetaEthEnvironmentConfig(network);
    const account = (await hre.ethers.getSigners())[0]!;

    return { config, account };
}
