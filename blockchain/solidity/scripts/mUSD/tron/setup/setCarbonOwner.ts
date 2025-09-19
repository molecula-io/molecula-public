/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';
import { setTronOwner } from '../../../utils/setOwner';

export async function setCarbonOwner(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // First, transfer the LZ configurator role to the authorized address
    const accountantLZArtifact = await hre.artifacts.readArtifact('AccountantLZ');
    const accountantLZContract = hre.tronweb.contract(
        accountantLZArtifact.abi,
        contractsCarbon.tron.accountantLZ,
    );

    const currentLZConfigurator = hre.tronweb.address.fromHex(
        await accountantLZContract.authorizedLZConfigurator().call(),
    );

    if (currentLZConfigurator !== config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR) {
        console.log('Transferring AccountantLZ LZ configurator role to authorized address...');
        await accountantLZContract
            .setAuthorizedLZConfigurator(config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR)
            .send();
        console.log(
            `AccountantLZ LZ configurator role transferred to: ${config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR}`,
        );
    } else {
        console.log(`AccountantLZ LZ configurator role already set to: ${currentLZConfigurator}`);
    }

    // Then, transfer the ownership to the new owner
    const contracts = [
        { name: 'AccountantLZ', addr: contractsCarbon.tron.accountantLZ },
        { name: 'RebaseTokenTron', addr: contractsCarbon.tron.rebaseToken },
        { name: 'TronOracle', addr: contractsCarbon.tron.oracle },
    ];

    await setTronOwner(hre, environment, contracts, config.OWNER);
}
