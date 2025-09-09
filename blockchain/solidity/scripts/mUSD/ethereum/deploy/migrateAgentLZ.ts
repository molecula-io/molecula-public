import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../../configs';
import { getConfig } from '../../../utils/deployUtils';

export async function migrateAgentLZ(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    contracts: {
        supplyManagerAddress: string;
    },
) {
    const { config, account } = await getConfig(hre, environment);

    // Deploy agentLZ
    const AgentLZ = await hre.ethers.getContractFactory('AgentLZ');
    const agentLZ = await AgentLZ.deploy(
        account.address, // initial owner, to be able configuring the peer with AccountantLZ
        config.AGENT_AUTHORIZED_LZ_CONFIGURATOR,
        config.LAYER_ZERO_ENDPOINT,
        contracts.supplyManagerAddress,
        config.LAYER_ZERO_TRON_EID,
        config.USDT_ADDRESS,
        config.USDT_OFT,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await agentLZ.waitForDeployment();

    const agentLZAddress = await agentLZ.getAddress();
    console.log('AgentLZ deployed: ', agentLZAddress);
    console.log('Please, setup SupplyManager to work with the deployed AgentLZ separately.');

    return agentLZAddress;
}
