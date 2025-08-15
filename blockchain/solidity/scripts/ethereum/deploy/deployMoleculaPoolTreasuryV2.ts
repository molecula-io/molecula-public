import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type EnvironmentType,
    type ContractsNitrogen,
    type EVMAddress,
    type PoolData,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';
import { getConfig, readFromFile } from '../../utils/deployUtils';

export async function deployMoleculaPoolTreasuryV2(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const { config } = await getConfig(hre, environment);
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );

    const tokens: PoolData[] = [...config.MOLECULA_POOL_TOKENS];
    if (contractsNitrogen.eth.mUSDe !== '') {
        tokens.push({ token: contractsNitrogen.eth.mUSDe as EVMAddress, n: 0 });
    }

    const MoleculaPoolTreasuryV2 = await hre.ethers.getContractFactory('MoleculaPoolTreasuryV2');
    const moleculaPoolTreasuryV2 = await MoleculaPoolTreasuryV2.deploy(
        config.OWNER, // Note: owner is not deploy wallet
        tokens.map(x => x.token),
        config.POOL_KEEPER,
        contractsNitrogen.eth.supplyManager,
        config.WHITE_LIST,
        config.GUARDIAN_ADDRESS,
        hre.ethers.ZeroAddress,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await moleculaPoolTreasuryV2.waitForDeployment();
    return {
        moleculaPoolV2: await moleculaPoolTreasuryV2.getAddress(),
    };
}
