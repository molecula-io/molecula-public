/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { deployAccountantLZ, setUnderlyingToken } from './deployAccountantLZ';
import { deployOracle, setAutorizedUpdater } from './deployOracle';
import { deployRebaseToken } from './deployRebaseToken';
import { deploymUSDLock } from './deploymUSDLock';

export async function deployCarbon(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    // deploy Oracle
    const oracle = await deployOracle(hre, environment);

    const config = getTronEnvironmentConfig(environment);

    // get initial owner
    const initialOwner = hre.tronweb.defaultAddress.base58 as string;

    console.log('Initial owner:', initialOwner);

    // deploy Accountant LZ
    const accountantLZ = await deployAccountantLZ(hre, {
        initialOwner,
        authorizedLZConfiguratorAddress: config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR, // update after lz configuration
        endpoint: config.LAYER_ZERO_TRON_ENDPOINT,
        lzDstEid: config.LAYER_ZERO_ETHEREUM_EID,
        usdtAddress: config.USDT_ADDRESS,
        usdtOFTAddress: config.USDT_OFT,
        oracleAddress: oracle,
    });
    console.log('Accountant LZ deployed:', accountantLZ);

    // Set Accountant to Oracle
    await setAutorizedUpdater(hre.tronweb, oracle, accountantLZ);
    console.log('Oracle accountant set:', accountantLZ);

    // deploy RebaseToken
    const rebaseToken = await deployRebaseToken(hre, {
        initialOwner,
        accountantAddress: accountantLZ,
        initialShares: 0n, // set to zero, the initial shares are present only in Nitrogen
        oracleAddress: oracle,
        tokenName: config.MUSD_TOKEN_NAME,
        tokenSymbol: config.MUSD_TOKEN_SYMBOL,
        tokenDecimals: config.MUSD_TOKEN_DECIMALS,
        minDeposit: config.MUSD_TOKEN_MIN_DEPOSIT,
        minRedeem: config.MUSD_TOKEN_MIN_REDEEM,
    });
    console.log('RebaseToken deployed:', rebaseToken);

    // set vault for swap driver
    await setUnderlyingToken(hre.tronweb, {
        accountantLZ,
        moleculaToken: rebaseToken,
    });

    // deploy mUSDLock
    const mUSDLock = await deploymUSDLock(hre, rebaseToken);

    // all done
    console.log('Contracts deployed:');
    console.log('RebaseToken:', rebaseToken);
    console.log('Oracle:', oracle);
    console.log('accountantLZ:', accountantLZ);
    console.log('mUSDLock:', mUSDLock);
    console.log('accountantLZHex:', hre.tronweb.address.toHex(accountantLZ).slice(2));

    return {
        tron: {
            rebaseToken,
            oracle,
            accountantLZ,
            mUSDLock,
        },
        accountantLZHex: hre.tronweb.address.toHex(accountantLZ).slice(2),
    };
}
