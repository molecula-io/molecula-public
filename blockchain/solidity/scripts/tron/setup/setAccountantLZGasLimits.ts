/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
// "setup:dvn:production": "dotenv  -e .env.production hardhat run scripts/tron/setupShastaOAppDVN.ts --network shasta",
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TronWeb } from 'tronweb';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { OAPP_GAS_LIMITS_BY_ENV } from '../../../configs/layerzero/omniConfig';
import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';

export async function setAccountantLZGasLimits(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    environment: EnvironmentType,
) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // Create TronWeb instance
    const tronWeb = new TronWeb({
        fullHost: config.RPC_URL,
    });
    // Get private key
    const accountInfo = tronWeb.fromMnemonic(mnemonic, path);
    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }
    const privateKey = accountInfo.privateKey.substring(2);
    tronWeb.setPrivateKey(privateKey);

    // Define the smart contract address and ABI
    const artifact = await hre.artifacts.readArtifact('AccountantLZ');
    const accountantLZ = tronWeb.contract(artifact.abi, contractsCarbon.tron.accountantLZ);
    const { accountantGasLimits } = OAPP_GAS_LIMITS_BY_ENV[environment];

    for (const { msgType, baseGas, unitGas } of accountantGasLimits) {
        // Optional: skip if both are 0
        if (baseGas === 0 && unitGas === 0) {
            console.log(
                `Skipped ${name} (msgType: 0x${msgType.toString(16)}) — both base and unit are 0`,
            );
            continue;
        }

        try {
            await accountantLZ.setGasLimit(msgType, baseGas, unitGas).send();

            console.log(`Set gasLimit for (msgType: 0x${msgType.toString(16)})`);
            console.log(`   → base: ${baseGas.toString()}, unit: ${unitGas.toString()}`);
        } catch (err) {
            console.error(`Failed to set gasLimit for (msgType: 0x${msgType.toString(16)})`);
            console.error(`   ↪︎ Reason: ${err.reason || err.message}`);
        }
    }

    console.log('Done');
}
