import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronWeb } from '../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

export async function deployMockUSDT(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    network: EnvironmentType,
) {
    const { tronWeb, privateKey } = await getTronWeb(mnemonic, path, network);
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = tronWeb.address.fromPrivateKey(privateKey);

    if (!issuerAddress) {
        throw new Error('Invalid private key');
    }
    const artifact = await hre.artifacts.readArtifact('UsdtTron');

    const transaction = await tronWeb.transactionBuilder.createSmartContract(
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
    await tronWeb.trx.sendRawTransaction(await tronWeb.trx.sign(transaction, privateKey));

    const usdtAddress = await waitForDeployment(tronWeb, transaction);
    console.log(`Mock USDT address is : ${usdtAddress}`);
}

export async function deployUsdtOFT(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    network: EnvironmentType,
) {
    const { config, tronWeb, privateKey } = await getTronWeb(mnemonic, path, network);
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = tronWeb.address.fromPrivateKey(privateKey);

    if (!issuerAddress) {
        throw new Error('Invalid private key');
    }

    const artifact = await hre.artifacts.readArtifact('UsdtOFT');

    const transaction = await tronWeb.transactionBuilder.createSmartContract(
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
    await tronWeb.trx.sendRawTransaction(await tronWeb.trx.sign(transaction, privateKey));

    const usdtAddress = await waitForDeployment(tronWeb, transaction);
    console.log(`Mock UsdtOFT address is : ${usdtAddress}`);
}
