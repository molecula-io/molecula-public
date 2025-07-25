import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCore, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { setOwner } from '../../utils/setOwner';

export async function setCoreOwner(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCore: ContractsCore = await readFromFile(`${environment}/contracts_core.json`);
    const contracts = [
        { name: 'SupplyManager', addr: contractsCore.eth.supplyManager },
        { name: 'MoleculaPool', addr: contractsCore.eth.moleculaPool },
    ];

    const config = getEnvironmentConfig(environment);
    await setOwner(hre, contracts, config.OWNER);
}
