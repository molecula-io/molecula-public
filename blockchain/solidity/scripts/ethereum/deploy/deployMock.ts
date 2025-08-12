/**
 * Deploy Mock Contracts Script
 *
 * Usage via hardhat task (requires at least one flag):
 * - Deploy USDT: npx hardhat ethereumScope deployAaveMock --with-usdt --network <network>
 * - Deploy UsdtOFT: npx hardhat ethereumScope deployAaveMock --with-usdt-oft --network <network>
 * - Deploy mrETHMockAavePool: npx hardhat ethereumScope deployAaveMock --with-mr-eth-mock --network <network>
 * - Deploy multiple contracts: npx hardhat ethereumScope deployAaveMock --with-usdt --with-usdt-oft --with-mr-eth-mock --network <network>
 *
 * Note: At least one flag must be specified to deploy any contract.
 */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';
import { getConfig } from '../../utils/deployUtils';
import { verifyContract } from '../../verification/verificationUtils';

export async function deployUSDT(hre: HardhatRuntimeEnvironment) {
    // deploy USDT
    const USDT = await hre.ethers.getContractFactory('UsdtEthereum');
    const usdt = await USDT.deploy(hre.ethers.formatUnits(1000000, 6), 'Tether token', 'USDT', 6, {
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();
    console.log('usdt deployed: ', usdtAddress);

    await verifyContract(hre, 'USDT', usdtAddress, []);
}

export async function deployUsdtOFT(hre: HardhatRuntimeEnvironment) {
    const { config, account } = await getConfig(hre, EnvironmentType.devnet);

    // deploy UsdtOFT
    const UsdtOFT = await hre.ethers.getContractFactory('UsdtOFT');
    const usdtOFT = await UsdtOFT.deploy(
        config.LAYER_ZERO_ARBITRUM_EID,
        config.LAYER_ZERO_CELO_EID,
        config.LAYER_ZERO_ETHEREUM_EID,
        config.LAYER_ZERO_TRON_EID, // for ton testnet layerzero don't have eid
        config.LAYER_ZERO_TRON_EID,
        config.USDT_ADDRESS,
        config.LAYER_ZERO_ENDPOINT,
        account.address,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await usdtOFT.waitForDeployment();
    const usdtOftAddress = await usdtOFT.getAddress();
    console.log('usdt deployed: ', usdtOftAddress);

    await verifyContract(hre, 'UsdtOFT', usdtOftAddress, [
        config.LAYER_ZERO_ARBITRUM_EID,
        config.LAYER_ZERO_CELO_EID,
        config.LAYER_ZERO_ETHEREUM_EID,
        config.LAYER_ZERO_TRON_EID, // for ton testnet layerzero don't have eid
        config.LAYER_ZERO_TRON_EID,
        config.USDT_ADDRESS,
        config.LAYER_ZERO_ENDPOINT,
        account.address,
    ]);
}

export async function deploymrETHMockAavePool(hre: HardhatRuntimeEnvironment) {
    const mrETHMockAavePool = await hre.ethers.getContractFactory('MockAavePool');
    const mrETHMock = await mrETHMockAavePool.deploy();
    await mrETHMock.waitForDeployment();
    const mrETHMockAddress = await mrETHMock.getAddress();
    console.log('mrETHMock deployed: ', mrETHMockAddress);

    await verifyContract(hre, 'MockAavePool', mrETHMockAddress, []);
}
