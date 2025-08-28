import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsNitrogen,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT, type EthereumNetworkConfig } from '../../../../configs';
import { readFromFile } from '../../../utils/deployUtils';

export async function deployNitrogenTokenVault(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    config: EthereumNetworkConfig,
    account: HardhatEthersSigner,
    token: string,
    minDeposit: bigint,
    minRedeem: bigint,
) {
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );

    console.log('Deploying NitrogenTokenVault...');
    const NitrogenTokenVault = await hre.ethers.getContractFactory('NitrogenTokenVault');
    const nitrogenTokenVault = await NitrogenTokenVault.deploy(
        account.address,
        contractsNitrogen.eth.rebaseToken,
        contractsNitrogen.eth.supplyManager,
        contractsNitrogen.eth.rebaseTokenOwner,
        config.GUARDIAN_ADDRESS,
        hre.ethers.ZeroAddress,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await nitrogenTokenVault.waitForDeployment();
    console.log('NitrogenTokenVault is deployed');
    const nitrogenTokenVaultAddress = await nitrogenTokenVault.getAddress();
    console.log('NitrogenTokenVault address: ', nitrogenTokenVaultAddress);

    console.log('Initializing the contract');
    let tx = await nitrogenTokenVault.init(token, minDeposit, minRedeem);
    await tx.wait();

    console.log('Setting new owner (ownable2step) to: ', config.OWNER);
    tx = await nitrogenTokenVault.transferOwnership(config.OWNER);
    await tx.wait();

    return nitrogenTokenVaultAddress;
}
