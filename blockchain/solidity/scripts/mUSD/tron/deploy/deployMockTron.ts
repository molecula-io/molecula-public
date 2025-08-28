import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

export async function deployMockUSDT(hre: HardhatRuntimeEnvironment) {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('UsdtTron');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 1000000000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000 sun
            // @ts-ignore (probably wrong type annotation)
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore (probably wrong type annotation)
            parameters: [hre.ethers.formatUnits(1000000, 6), 'Tether token', 'USDT', 6],
        },
        issuerAddress,
    );

    // Send the transactions
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    const usdtAddress = await waitForDeployment(hre.tronweb, transaction);
    console.log(`Mock USDT address is : ${usdtAddress}`);
}

export async function deployUsdtOFT(hre: HardhatRuntimeEnvironment, network: EnvironmentType) {
    const config = getTronEnvironmentConfig(network);
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('UsdtOFT');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 3000000000, // The maximum TRX burns for resource consumption（3TRX = 3,000,000 sun
            // @ts-ignore (probably wrong type annotation)
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore (probably wrong type annotation)
            parameters: [
                config.LAYER_ZERO_ARBITRUM_EID,
                config.LAYER_ZERO_CELO_EID,
                config.LAYER_ZERO_ETHEREUM_EID,
                config.LAYER_ZERO_TRON_EID, // for ton testnet layerzero don't have eid
                config.LAYER_ZERO_TRON_EID,
                config.USDT_ADDRESS,
                config.LAYER_ZERO_TRON_ENDPOINT,
                issuerAddress,
            ],
        },
        issuerAddress,
    );

    // Send the transactions
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    const usdtAddress = await waitForDeployment(hre.tronweb, transaction);
    console.log(`Mock UsdtOFT address is : ${usdtAddress}`);
}
