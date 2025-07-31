/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { setTronOwner } from '../../utils/setOwner';

export async function setCarbonOwner(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    {
        const contracts = [
            { name: 'AccountantLZ', addr: contractsCarbon.tron.accountantLZ },
            { name: 'RebaseTokenTron', addr: contractsCarbon.tron.rebaseToken },
            { name: 'TronOracle', addr: contractsCarbon.tron.oracle },
        ];
        await setTronOwner(hre, environment, contracts, config.OWNER);
    }
}
