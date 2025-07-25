import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { setReceiveConfig, setSendConfig, setPeer } from '../../utils/lzEthSetupUtils';
import { getOAppConfig } from '../../utils/lzSetupUtils';

export async function setupOAppDVN(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getEnvironmentConfig(environment);
    // Create a contract instance
    const lzEndpoint = await hre.ethers.getContractAt(
        'ILayerZeroEndpointV2',
        config.LAYER_ZERO_ENDPOINT,
    );
    // Define the addresses and parameters
    const oappAddress = contractsCarbon.eth.agentLZ; // AgentLZ
    const remoteEid = config.LAYER_ZERO_TRON_EID; // Example target endpoint ID, Binance Smart Chain
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getOAppConfig(
        lzEndpoint,
        remoteEid,
        oappAddress,
    );
    console.log('AgentLZ sendLibAddress:', sendLibAddress);
    console.log('AgentLZ receiveLibAddress:', receiveLibAddress);

    // Set peer
    await setPeer(hre, oappAddress, remoteEid, contractsCarbon.tron.accountantLZ);
    // Set send config
    await setSendConfig(hre, lzEndpoint, remoteEid, oappAddress, sendLibAddress);
    // Set receive config
    await setReceiveConfig(hre, lzEndpoint, remoteEid, oappAddress, receiveLibAddress);

    console.log('Done');
}
