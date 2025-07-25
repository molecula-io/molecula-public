/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { TronWeb } from 'tronweb';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { setTronOwner } from '../../utils/setOwner';

export async function setCarbonOwner(
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

    const accountInfo = tronWeb.fromMnemonic(mnemonic, path);

    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }

    const privateKey = accountInfo.privateKey.substring(2);
    {
        const contracts = [
            { name: 'AccountantLZ', addr: contractsCarbon.tron.accountantLZ },
            { name: 'RebaseTokenTron', addr: contractsCarbon.tron.rebaseToken },
            { name: 'TronOracle', addr: contractsCarbon.tron.oracle },
        ];
        await setTronOwner(hre, privateKey, environment, contracts, config.OWNER);
    }
}
