// "setup:dvn:production": "dotenv  -e .env.production hardhat run scripts/tron/setupShastaOAppDVN.ts --network shasta",
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TronWeb } from 'tronweb';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';
import { getTronOAppConfig } from '../../utils/lzSetupUtils';
import { setReceiveConfig, setSendConfig, setPeer } from '../../utils/lzTronSetupUtils';

export async function setupOAppDVN(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    environment: EnvironmentType,
) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // Create TronWeb instance
    const tronWeb = new TronWeb({
        fullHost: config.RPC_URL,
    });
    // Get private key
    const accountInfo = tronWeb.fromMnemonic(mnemonic, path);
    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }
    const privateKey = accountInfo.privateKey.substring(2);
    tronWeb.setPrivateKey(privateKey);

    // get owner
    const initialOwner = tronWeb.address.fromPrivateKey(privateKey);
    console.log('Initial owner:', initialOwner);

    // Define the smart contract address and ABI
    const lzEndpointAddress = config.LAYER_ZERO_TRON_ENDPOINT;
    const artifact = await hre.artifacts.readArtifact('ILayerZeroEndpointV2');
    const lzEndpoint = tronWeb.contract(artifact.abi, lzEndpointAddress);

    // Define the addresses and parameters
    const oappAddress = contractsCarbon.tron.accountantLZ;
    // Remote EID
    const remoteEid = config.LAYER_ZERO_ETHEREUM_EID;
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getTronOAppConfig(
        tronWeb,
        lzEndpoint,
        remoteEid,
        oappAddress,
    );
    console.log('sendLibAddress:', sendLibAddress);
    console.log('receiveLibAddress:', receiveLibAddress);

    // Set Peer
    await setPeer(hre, tronWeb, oappAddress, remoteEid, contractsCarbon.eth.agentLZ);
    // Set Receive Config
    await setReceiveConfig(tronWeb, lzEndpoint, remoteEid, oappAddress, receiveLibAddress);
    // Set Send Config
    await setSendConfig(tronWeb, lzEndpoint, remoteEid, oappAddress, sendLibAddress);

    console.log('Done');
}
