/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { deployAccountantLZ, setUnderlyingToken } from './deployAccountantLZ';

export async function migrateAccountantLZ(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    {
        rebaseTokenAddress,
        oracleAddress,
    }: {
        rebaseTokenAddress: string;
        oracleAddress: string;
    },
) {
    const config = getTronEnvironmentConfig(environment);

    // Get initial owner
    const initialOwner = hre.tronweb.defaultAddress.base58 as string;
    console.log('Initial owner:', initialOwner);

    // Deploy Accountant LZ
    const accountantLZAddress = await deployAccountantLZ(hre, {
        initialOwner, // initial owner, to be able configuring the peer with AgentLZ
        authorizedLZConfiguratorAddress: config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR, // update after lz configuration
        endpoint: config.LAYER_ZERO_TRON_ENDPOINT,
        lzDstEid: config.LAYER_ZERO_ETHEREUM_EID,
        usdtAddress: config.USDT_ADDRESS,
        usdtOFTAddress: config.USDT_OFT,
        oracleAddress,
    });
    console.log('Accountant LZ deployed:', accountantLZAddress);
    console.log('Please, setup RebaseToken to work with the deployed AccountantLZ separately.');
    console.log(
        'Please, setup Oracle to make the deployed AccountantLZ authorized to update it separately.',
    );

    // Set underlying token for AccountantLZ
    await setUnderlyingToken(hre.tronweb, {
        accountantLZ: accountantLZAddress,
        moleculaToken: rebaseTokenAddress,
    });

    // All done
    console.log('Contracts deployed:');
    console.log('accountantLZ:', accountantLZAddress);
    console.log('accountantLZHex:', hre.tronweb.address.toHex(accountantLZAddress).slice(2));

    return accountantLZAddress;
}
