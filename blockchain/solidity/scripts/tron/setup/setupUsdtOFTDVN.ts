// "setup:dvn:production": "dotenv  -e .env.production hardhat run scripts/tron/setupShastaUsdtOFTDVN.ts --network shasta",
// "setup:dvn:test": "                                 hardhat run scripts/tron/setupShastaUsdtOFTDVN.ts --network shasta",
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TronWeb } from 'tronweb';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, getTronEnvironmentConfig } from '../../utils/deployUtils';
import { getTronOAppConfig } from '../../utils/lzSetupUtils';
import {
    setPeer,
    setReceiveConfig,
    setSendConfig,
    setUsdtOftFee,
} from '../../utils/lzTronSetupUtils';

export async function setupUsdtOftDVN(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    environment: EnvironmentType,
) {
    const tronConfig = getTronEnvironmentConfig(environment);
    const ethConfig = getEnvironmentConfig(environment);
    // Create TronWeb instance
    const tronWeb = new TronWeb({
        fullHost: tronConfig.RPC_URL,
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
    const artifact = await hre.artifacts.readArtifact('ILayerZeroEndpointV2');
    const lzEndpointAddress = tronConfig.LAYER_ZERO_TRON_ENDPOINT;
    const lzEndpoint = tronWeb.contract(artifact.abi, lzEndpointAddress);

    // Define the addresses and parameters
    const usdtOFTAddress = tronConfig.USDT_OFT; // USDT_OFT
    // Remote EID
    const remoteEid = tronConfig.LAYER_ZERO_ETHEREUM_EID;
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getTronOAppConfig(
        tronWeb,
        lzEndpoint,
        remoteEid,
        usdtOFTAddress,
    );
    console.log('usdtOFT sendLibAddress:', sendLibAddress);
    console.log('usdtOFT receiveLibAddress:', receiveLibAddress);

    if (remoteEid === 40161) {
        // Set Peer
        await setPeer(hre, tronWeb, usdtOFTAddress, remoteEid, ethConfig.USDT_OFT);
        // Set Receive Config
        await setReceiveConfig(tronWeb, lzEndpoint, remoteEid, usdtOFTAddress, receiveLibAddress);
        // Set Send Config
        await setSendConfig(tronWeb, lzEndpoint, remoteEid, usdtOFTAddress, sendLibAddress);
        // Set Fee for usdtOFT
        await setUsdtOftFee(hre, tronWeb, usdtOFTAddress);

        console.log('Done');
    }
}
