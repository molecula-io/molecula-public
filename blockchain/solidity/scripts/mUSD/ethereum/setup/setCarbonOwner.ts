import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';
import { setOwner } from '../../../utils/setOwner';

export async function setCarbonOwner(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getEnvironmentConfig(environment);

    const contracts = [{ name: 'AgentLZ', addr: contractsCarbon.eth.agentLZ }];

    await setOwner(hre, contracts, config.OWNER);
}
