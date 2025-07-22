import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';
import type { ContractsMrEth } from '@molecula-monorepo/blockchain.addresses/deploy';

import { readFromFile, getMrEthEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from './verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'holesky' || hre.network.name === 'sepolia'
            ? EnvironmentType.devnet
            : EnvironmentType['mainnet/beta'];
    const config = getMrEthEnvironmentConfig(envType, hre.network.name);

    const contractsConfig: ContractsMrEth = await readFromFile(`${envType}/contracts_mr_eth.json`);

    // Select the appropriate contract configuration based on network
    const contractToVerify =
        hre.network.name === 'holesky' && 'holesky' in contractsConfig
            ? contractsConfig.holesky
            : contractsConfig.eth;

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'Delegator', contractToVerify.delegatorImplementation, []);

    await verifyContract(hre, 'DepositManager', contractToVerify.depositManager, [
        account.address,
        account.address,
        account.address,
        contractToVerify.supplyManagerV2,
        config.WETH_ADDRESS,
        config.STRATEGY_FACTORY,
        config.DELEGATION_MANAGER,
        config.REWARDS_COORDINATOR,
        contractToVerify.delegatorImplementation,
    ]);

    await verifyContract(hre, 'SupplyManagerV2WithNative', contractToVerify.supplyManagerV2, [
        account.address,
        account.address,
        contractToVerify.depositManager,
        config.APY_FORMATTER,
        contractToVerify.mrETH,
    ]);

    await verifyContract(hre, 'RebaseTokenV2', contractToVerify.mrETH, [
        contractToVerify.supplyManagerV2,
        account.address,
        config.MRETH_TOKEN_NAME,
        config.MRETH_TOKEN_SYMBOL,
        config.MRETH_TOKEN_DECIMALS,
        contractToVerify.supplyManagerV2,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractToVerify.vaultWETH, [
        account.address,
        contractToVerify.mrETH,
        contractToVerify.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractToVerify.vaultETH, [
        account.address,
        contractToVerify.mrETH,
        contractToVerify.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthNativeTokenVault', contractToVerify.vaultETH, [
        account.address,
        contractToVerify.mrETH,
        contractToVerify.supplyManagerV2,
        account.address,
    ]);
}

async function main() {
    const hardhat = await import('hardhat');
    const hre: HardhatRuntimeEnvironment = hardhat.default;

    await runVerify(hre);
}

main().catch(error => {
    console.error('Failed to verify:', error);
    process.exit(1);
});
