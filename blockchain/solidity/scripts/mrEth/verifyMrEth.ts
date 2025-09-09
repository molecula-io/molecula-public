import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';
import type { ContractsMrEth } from '@molecula-monorepo/blockchain.addresses/deploy';

import { ETH_VIRTUAL_OFFSET } from '../../configs';
import { readFromFile, getMrEthEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from '../verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'ethereum' ? EnvironmentType['mainnet/beta'] : EnvironmentType.devnet;

    const config = getMrEthEnvironmentConfig(envType, hre.network.name);

    const contractsConfig: ContractsMrEth = await readFromFile(`${envType}/contracts_mr_eth.json`);

    // Select the appropriate contract configuration based on network
    let contractToVerify;

    if (hre.network.name === 'holesky' && 'holesky' in contractsConfig) {
        contractToVerify = contractsConfig.holesky;
    } else if (hre.network.name === 'hoodi' && 'hoodi' in contractsConfig) {
        contractToVerify = contractsConfig.hoodi;
    } else {
        contractToVerify = contractsConfig.eth;
    }

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'Delegator', contractToVerify.delegatorImplementation, []);

    await verifyContract(hre, 'MoleculaBuffer', contractToVerify.moleculaBuffer, [
        config.MOLECULA_BUFFER_NAME,
        config.MOLECULA_BUFFER_SYMBOL,
        account.address,
        config.WETH_ADDRESS,
    ]);

    await verifyContract(hre, 'DepositManagerLib', contractToVerify.depositManagerLib, []);

    await verifyContract(hre, 'DepositManagerPool', contractToVerify.depositManagerPool, [
        account.address,
        contractToVerify.supplyManagerV2,
        config.WETH_ADDRESS,
        config.STRATEGY_FACTORY,
        config.DELEGATION_MANAGER,
        config.REWARDS_COORDINATOR,
        contractToVerify.depositManagerRestaker,
    ]);

    await verifyContract(
        hre,
        'DepositManagerRestaker',
        contractToVerify.depositManagerRestaker,
        [],
    );

    await verifyContract(hre, 'SupplyManagerV2WithNative', contractToVerify.supplyManagerV2, [
        account.address,
        account.address,
        contractToVerify.depositManagerPool,
        config.APY_FORMATTER,
        contractToVerify.mrETH,
        ETH_VIRTUAL_OFFSET,
    ]);

    await verifyContract(hre, 'RewardBearingToken', contractToVerify.mrETH, [
        config.MRETH_TOKEN_NAME,
        config.MRETH_TOKEN_SYMBOL,
        account.address,
        contractToVerify.supplyManagerV2,
        contractToVerify.supplyManagerV2,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractToVerify.wEthVault, [
        account.address,
        contractToVerify.mrETH,
        contractToVerify.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthAssetTokenVault', contractToVerify.stEthVault, [
        account.address,
        contractToVerify.mrETH,
        contractToVerify.supplyManagerV2,
        account.address,
    ]);

    await verifyContract(hre, 'MrEthNativeTokenVault', contractToVerify.ethVault, [
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
