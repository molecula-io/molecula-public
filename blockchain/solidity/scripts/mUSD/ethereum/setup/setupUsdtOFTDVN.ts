// "setup:dvn:test": "                                 hardhat run scripts/ethereum/setupSepoliaUsdtOFTDVN.ts --network sepolia",
import { Options } from '@layerzerolabs/lz-v2-utilities';

import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, getTronEnvironmentConfig } from '../../../utils/deployUtils';
import {
    setPeer,
    setReceiveConfig,
    setSendConfig,
    setEnforcedOptions,
    setUsdtOftFee,
} from '../../../utils/lzEthSetupUtils';
import { getOAppConfig } from '../../../utils/lzSetupUtils';

export async function setupUsdtOftDVN(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const [deployer] = await hre.ethers.getSigners();
    console.log('Wallet address: ', deployer!.address);
    console.log('Block #', await hre.ethers.provider.getBlockNumber());
    console.log(
        'ETH balance: ',
        hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer!.address)),
    );

    const tronConfig = getTronEnvironmentConfig(environment);
    const ethConfig = getEnvironmentConfig(environment);

    // Create a contract instance
    const lzEndpoint = await hre.ethers.getContractAt(
        'ILayerZeroEndpointV2',
        ethConfig.LAYER_ZERO_ENDPOINT,
    );
    // Define the addresses and parameters
    const usdtOFTAddress = ethConfig.USDT_OFT; // USDT_OFT
    const remoteEid = ethConfig.LAYER_ZERO_TRON_EID; // Example target endpoint ID, Binance Smart Chain
    // Get OApp Config
    const { sendLibAddress, receiveLibAddress } = await getOAppConfig(
        lzEndpoint,
        remoteEid,
        usdtOFTAddress,
    );
    console.log('usdtOFT sendLibAddress:', sendLibAddress);
    console.log('usdtOFT receiveLibAddress:', receiveLibAddress);

    if (remoteEid === 40420) {
        // Set peer
        await setPeer(hre, usdtOFTAddress, remoteEid, tronConfig.USDT_OFT);
        // Set send config
        await setSendConfig(
            hre,
            lzEndpoint,
            remoteEid,
            usdtOFTAddress,
            sendLibAddress,
            environment,
        );
        // Set receive config
        await setReceiveConfig(
            hre,
            lzEndpoint,
            remoteEid,
            usdtOFTAddress,
            receiveLibAddress,
            environment,
        );
        // Set Fee for usdtOFT
        await setUsdtOftFee(hre, usdtOFTAddress);

        console.log('Done');

        // Extra Options (LayerZero)
        const extraOption = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex();
        console.log('Setup Extra Options:', extraOption);

        await setEnforcedOptions(hre, usdtOFTAddress, remoteEid, 3, extraOption);
    }
}
