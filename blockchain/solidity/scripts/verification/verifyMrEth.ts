import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';
import type { ContractsMrEth } from '@molecula-monorepo/blockchain.addresses/deploy';

import { readFromFile, getEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from './verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'sepolia' ? EnvironmentType.devnet : EnvironmentType['mainnet/beta'];
    const config = getEnvironmentConfig(envType);

    const contractsConfig: ContractsMrEth = await readFromFile(`${envType}/contracts_mr_eth.json`);

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'Delegator', contractsConfig.eth.delegatorImplementation, []);

    await verifyContract(hre, 'DepositManager', contractsConfig.eth.depositManager, [
        account.address,
        account.address,
        account.address,
        contractsConfig.eth.supplyManagerV2,
        config.WETH_ADDRESS,
        config.STRATEGY_FACTORY,
        config.DELEGATION_MANAGER,
        config.REWARDS_COORDINATOR,
        contractsConfig.eth.delegatorImplementation,
    ]);

    await verifyContract(hre, 'SupplyManagerV2WithNative', contractsConfig.eth.supplyManagerV2, [
        account.address,
        account.address,
        contractsConfig.eth.depositManager,
        config.APY_FORMATTER,
        contractsConfig.eth.mrETH,
    ]);

    await verifyContract(hre, 'RebaseTokenV2', contractsConfig.eth.mrETH, [
        contractsConfig.eth.supplyManagerV2,
        account.address,
        config.MRETH_TOKEN_NAME,
        config.MRETH_TOKEN_SYMBOL,
        config.MRETH_TOKEN_DECIMALS,
        contractsConfig.eth.supplyManagerV2,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractsConfig.eth.vaultWETH, [
        account.address,
        contractsConfig.eth.mrETH,
        contractsConfig.eth.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractsConfig.eth.vaultETH, [
        account.address,
        contractsConfig.eth.mrETH,
        contractsConfig.eth.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthNativeTokenVault', contractsConfig.eth.vaultETH, [
        account.address,
        contractsConfig.eth.mrETH,
        contractsConfig.eth.supplyManagerV2,
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
