/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCarbon,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { getTronWeb, readFromFile } from '../utils/deployUtils';

import { deployAccountantLZ, setUnderlyingToken } from './deploy/deployAccountantLZ';
import { deployOracle, setAutorizedUpdater } from './deploy/deployOracle';

export async function migrateAccountantLZwithOracle(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    environment: EnvironmentType,
) {
    const { config, tronWeb, privateKey } = await getTronWeb(mnemonic, path, environment);

    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );

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
        config.ORACLE_AUTHORIZED_UPDATER,
    );
    console.log('Oracle deployed:', oracle);

    // deploy Accountant LZ
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
    await setAutorizedUpdater(tronWeb, privateKey, oracle, accountantLZ);
    console.log('Oracle accountant set:', accountantLZ);

    // set vault for swap driver
    await setUnderlyingToken(tronWeb, privateKey, {
        accountantLZ,
        moleculaToken: contractsCarbon.tron.rebaseToken,
    });

    // all done
    console.log('Contracts deployed:');
    console.log('Oracle:', oracle);
    console.log('accountantLZ:', accountantLZ);
    console.log('accountantLZHex:', tronWeb.address.toHex(accountantLZ).slice(2));

    return {
        tron: {
            oracle,
            accountantLZ,
        },
        accountantLZHex: tronWeb.address.toHex(accountantLZ).slice(2),
    };
}
