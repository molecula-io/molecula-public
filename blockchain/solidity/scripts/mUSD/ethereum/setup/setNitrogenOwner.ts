/* eslint-disable no-restricted-syntax */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';
import { setOwner } from '../../../utils/setOwner';

export async function setNitrogenOwner(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );
    const contracts = [
        { name: 'SupplyManager', addr: contractsNitrogen.eth.supplyManager },
        { name: 'MoleculaPool', addr: contractsNitrogen.eth.moleculaPool },
        { name: 'AccountantAgent', addr: contractsNitrogen.eth.accountantAgent },
        { name: 'RebaseToken', addr: contractsNitrogen.eth.rebaseToken },
    ];
    if (contractsNitrogen.eth.rebaseTokenOwner !== '') {
        contracts.push({ name: 'RebaseTokenOwner', addr: contractsNitrogen.eth.rebaseTokenOwner });
    }
    for (const [tokenName, tokenVault] of Object.entries(contractsNitrogen.eth.tokenVaults)) {
        contracts.push({ name: `TokenVault#${tokenName}`, addr: tokenVault as string });
    }

    const config = getEnvironmentConfig(environment);
    await setOwner(hre, contracts, config.OWNER);
}
