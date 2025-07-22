import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsNitrogen,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';
import { getConfig, readFromFile } from '../../utils/deployUtils';

export async function deployRebaseTokenOwner(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const { config } = await getConfig(hre, environment);
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );

    const RebaseTokenOwner = await hre.ethers.getContractFactory('RebaseTokenOwner');
    const rebaseTokenOwner = await RebaseTokenOwner.deploy(
        config.OWNER, // Note: the owner is not deploy wallet
        contractsNitrogen.eth.rebaseToken,
        config.GUARDIAN_ADDRESS,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await rebaseTokenOwner.waitForDeployment();
    const rebaseTokenOwnerAddress = await rebaseTokenOwner.getAddress();
    console.log('RebaseTokenOwner address: ', rebaseTokenOwnerAddress);
    return rebaseTokenOwnerAddress;
}
