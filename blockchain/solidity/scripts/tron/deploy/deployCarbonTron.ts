/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronWeb } from '../../utils/deployUtils';

import { deployAccountantLZ, setUnderlyingToken } from './deployAccountantLZ';
import { deployOracle, setOracleAccountant } from './deployOracle';
import { deployRebaseToken } from './deployRebaseToken';
import { deploymUSDLock } from './deploymUSDLock';

export async function deployCarbon(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    network: EnvironmentType,
) {
    const { config, tronWeb, privateKey } = await getTronWeb(mnemonic, path, network);

    // get initial owner
    const initialOwner = tronWeb.address.fromPrivateKey(privateKey);

    if (!initialOwner) {
        throw new Error('Invalid private key');
    }

    console.log('Initial owner:', initialOwner);

    // deploy Oracle
    const oracle = await deployOracle(
        hre,
        tronWeb,
        privateKey,
        config.MUSD_TOKEN_INITIAL_SUPPLY,
        config.MUSD_TOKEN_INITIAL_SUPPLY,
        initialOwner,
        initialOwner, // accountant update latter
        config.ORACLE_AUTHORIZED_UPDATER,
    );
    console.log('Oracle deployed:', oracle);

    // deploy Swap Accountant LZ
    const accountantLZ = await deployAccountantLZ(hre, tronWeb, privateKey, {
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
    await setOracleAccountant(tronWeb, privateKey, oracle, accountantLZ);
    console.log('Oracle accountant set:', accountantLZ);

    // deploy RebaseToken
    const rebaseToken = await deployRebaseToken(hre, tronWeb, privateKey, {
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
    await setUnderlyingToken(tronWeb, privateKey, {
        accountantLZ,
        moleculaToken: rebaseToken,
    });

    // deploy mUSDLock
    const mUSDLock = await deploymUSDLock(hre, tronWeb, privateKey, rebaseToken);

    // all done
    console.log('Contracts deployed:');
    console.log('RebaseToken:', rebaseToken);
    console.log('Oracle:', oracle);
    console.log('accountantLZ:', accountantLZ);
    console.log('mUSDLock:', mUSDLock);
    console.log('accountantLZHex:', tronWeb.address.toHex(accountantLZ).slice(2));

    return {
        tron: {
            rebaseToken,
            oracle,
            accountantLZ,
            mUSDLock,
        },
        accountantLZHex: tronWeb.address.toHex(accountantLZ).slice(2),
    };
}
