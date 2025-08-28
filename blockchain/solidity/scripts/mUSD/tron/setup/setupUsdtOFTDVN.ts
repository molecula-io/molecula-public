// "setup:dvn:production": "dotenv  -e .env.production hardhat run scripts/tron/setupShastaUsdtOFTDVN.ts --network shasta",
// "setup:dvn:test": "                                 hardhat run scripts/tron/setupShastaUsdtOFTDVN.ts --network shasta",
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, getTronEnvironmentConfig } from '../../../utils/deployUtils';
import { getTronOAppConfig } from '../../../utils/lzSetupUtils';
import {
    setPeer,
    setReceiveConfig,
    setSendConfig,
    setUsdtOftFee,
} from '../../../utils/lzTronSetupUtils';

export async function setupUsdtOftDVN(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const tronConfig = getTronEnvironmentConfig(environment);
    const ethConfig = getEnvironmentConfig(environment);

    // get owner
    console.log('Initial owner:', hre.tronweb.defaultAddress.base58);

    // Define the smart contract address and ABI
    const artifact = await hre.artifacts.readArtifact('ILayerZeroEndpointV2');
    const lzEndpointAddress = tronConfig.LAYER_ZERO_TRON_ENDPOINT;
    const lzEndpoint = hre.tronweb.contract(artifact.abi, lzEndpointAddress);

    // Define the addresses and parameters
    const usdtOFTAddress = tronConfig.USDT_OFT; // USDT_OFT
    // Remote EID
    const remoteEid = tronConfig.LAYER_ZERO_ETHEREUM_EID;
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getTronOAppConfig(
        hre.tronweb,
        lzEndpoint,
        remoteEid,
        usdtOFTAddress,
    );
    console.log('usdtOFT sendLibAddress:', sendLibAddress);
    console.log('usdtOFT receiveLibAddress:', receiveLibAddress);

    if (remoteEid === 40161) {
        // Set Peer
        await setPeer(hre, hre.tronweb, usdtOFTAddress, remoteEid, ethConfig.USDT_OFT);
        // Set Receive Config
        await setReceiveConfig(
            hre.tronweb,
            lzEndpoint,
            remoteEid,
            usdtOFTAddress,
            receiveLibAddress,
        );
        // Set Send Config
        await setSendConfig(hre.tronweb, lzEndpoint, remoteEid, usdtOFTAddress, sendLibAddress);
        // Set Fee for usdtOFT
        await setUsdtOftFee(hre, hre.tronweb, usdtOFTAddress);

        console.log('Done');
    }
}
