import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type EnvironmentType,
    type ContractsNitrogen,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';

import { getConfig, readFromFile } from '../../utils/deployUtils';

export async function deployAccountantAgent(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const { config } = await getConfig(hre, environment);
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );
    const Agent = await hre.ethers.getContractFactory('AccountantAgent');
    const agent = await Agent.deploy(
        config.OWNER, // Note: owner is not deploy wallet
        contractsNitrogen.eth.rebaseToken,
        contractsNitrogen.eth.supplyManager,
        config.USDT_ADDRESS,
        config.GUARDIAN_ADDRESS,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await agent.waitForDeployment();
    return {
        accountantAgent: await agent.getAddress(),
    };
}
