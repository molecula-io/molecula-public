/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCarbon,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { deployAccountantLZ, setUnderlyingToken } from '../deploy/deployAccountantLZ';

import { deployOracle, setAutorizedUpdater } from '../deploy/deployOracle';

export async function migrateAccountantLZwithOracle(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const config = getTronEnvironmentConfig(environment);

    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );

    // get initial owner
    const initialOwner = hre.tronweb.defaultAddress.base58;

    if (!initialOwner) {
        throw new Error('Invalid private key');
    }

    console.log('Initial owner:', initialOwner);

    // deploy Oracle
    const oracle = await deployOracle(
        hre,
        config.MUSD_TOKEN_INITIAL_SUPPLY,
        config.MUSD_TOKEN_INITIAL_SUPPLY,
        initialOwner,
        config.ORACLE_AUTHORIZED_UPDATER,
    );
    console.log('Oracle deployed:', oracle);

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

    // set vault for swap driver
    await setUnderlyingToken(hre.tronweb, {
        accountantLZ,
        moleculaToken: contractsCarbon.tron.rebaseToken,
    });

    // all done
    console.log('Contracts deployed:');
    console.log('Oracle:', oracle);
    console.log('accountantLZ:', accountantLZ);
    console.log('accountantLZHex:', hre.tronweb.address.toHex(accountantLZ).slice(2));

    return {
        tron: {
            oracle,
            accountantLZ,
        },
        accountantLZHex: hre.tronweb.address.toHex(accountantLZ).slice(2),
    };
}
