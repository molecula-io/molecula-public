// "setup:dvn:production": "dotenv  -e .env.production hardhat run scripts/tron/setupShastaOAppDVN.ts --network shasta",
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';
import { getTronOAppConfig } from '../../../utils/lzSetupUtils';
import { setReceiveConfig, setSendConfig, setPeer } from '../../../utils/lzTronSetupUtils';

export async function setupOAppDVN(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // get owner
    console.log('Initial owner:', hre.tronweb.defaultAddress.base58);

    // Define the smart contract address and ABI
    const lzEndpointAddress = config.LAYER_ZERO_TRON_ENDPOINT;
    const artifact = await hre.artifacts.readArtifact('ILayerZeroEndpointV2');
    const lzEndpoint = hre.tronweb.contract(artifact.abi, lzEndpointAddress);

    // Define the addresses and parameters
    const oappAddress = contractsCarbon.tron.accountantLZ;
    // Remote EID
    const remoteEid = config.LAYER_ZERO_ETHEREUM_EID;
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getTronOAppConfig(
        hre.tronweb,
        lzEndpoint,
        remoteEid,
        oappAddress,
    );
    console.log('sendLibAddress:', sendLibAddress);
    console.log('receiveLibAddress:', receiveLibAddress);

    // Set Peer
    await setPeer(hre, hre.tronweb, oappAddress, remoteEid, contractsCarbon.eth.agentLZ);
    // Set Receive Config
    await setReceiveConfig(
        hre.tronweb,
        lzEndpoint,
        remoteEid,
        oappAddress,
        receiveLibAddress,
        environment,
    );
    // Set Send Config
    await setSendConfig(
        hre.tronweb,
        lzEndpoint,
        remoteEid,
        oappAddress,
        sendLibAddress,
        environment,
    );

    console.log('Done');
}
