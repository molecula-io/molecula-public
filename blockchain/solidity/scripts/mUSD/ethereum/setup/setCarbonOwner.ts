import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';
import { setOwner } from '../../../utils/setOwner';

export async function setCarbonOwner(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getEnvironmentConfig(environment);

    // First, transfer the LZ configurator role to the authorized address
    const agentLZContract = await hre.ethers.getContractAt('AgentLZ', contractsCarbon.eth.agentLZ);
    const currentLZConfigurator = await agentLZContract.authorizedLZConfigurator();

    if (currentLZConfigurator !== config.AGENT_AUTHORIZED_LZ_CONFIGURATOR) {
        console.log('Transferring AgentLZ LZ configurator role to authorized address...');
        const setConfigTx = await agentLZContract.setAuthorizedLZConfigurator(
            config.AGENT_AUTHORIZED_LZ_CONFIGURATOR,
        );
        await setConfigTx.wait();
        console.log(
            `AgentLZ LZ configurator role transferred to: ${config.AGENT_AUTHORIZED_LZ_CONFIGURATOR}`,
        );
    } else {
        console.log(`AgentLZ LZ configurator role already set to: ${currentLZConfigurator}`);
    }

    // Then, transfer the ownership to the new owner
    const contracts = [{ name: 'AgentLZ', addr: contractsCarbon.eth.agentLZ }];

    await setOwner(hre, contracts, config.OWNER);
}
