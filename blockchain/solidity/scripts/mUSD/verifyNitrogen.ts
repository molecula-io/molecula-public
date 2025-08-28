/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { ethers } from 'hardhat';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCore,
    type EVMAddress,
    EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';
import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses/deploy';

import { readFromFile, getEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from '../verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'sepolia' ? EnvironmentType.devnet : EnvironmentType['mainnet/beta'];
    const config = getEnvironmentConfig(envType);

    const contractsCore: ContractsCore = await readFromFile(`${envType}/contracts_core.json`);

    const account = (await hre.ethers.getSigners())[0]!;

    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${envType}/contracts_nitrogen.json`,
    );

    const tokens = [...config.MOLECULA_POOL_TOKENS];
    if (contractsNitrogen.eth.mUSDe !== '') {
        tokens.push({ token: contractsNitrogen.eth.mUSDe as EVMAddress, n: 0 });
    }

    await verifyContract(hre, 'MUSDLock', contractsNitrogen.eth.mUSDLock, [
        contractsNitrogen.eth.rebaseToken,
    ]);

    await verifyContract(hre, 'MUSDE', contractsNitrogen.eth.mUSDe, [
        config.SUSDE_ADDRESS,
        contractsNitrogen.eth.poolKeeper,
    ]);

    await verifyContract(hre, 'MoleculaPoolTreasuryV2', contractsNitrogen.eth.moleculaPool, [
        account.address,
        tokens.map(x => x.token),
        contractsNitrogen.eth.poolKeeper,
        contractsNitrogen.eth.supplyManager,
        config.WHITE_LIST,
        config.GUARDIAN_ADDRESS,
    ]);

    await verifyContract(hre, 'AccountantAgent', contractsNitrogen.eth.accountantAgent, [
        account.address,
        contractsNitrogen.eth.rebaseToken,
        contractsNitrogen.eth.supplyManager,
        config.USDT_ADDRESS,
        config.GUARDIAN_ADDRESS,
    ]);

    await verifyContract(hre, 'SupplyManager', contractsNitrogen.eth.supplyManager, [
        account.address,
        config.POOL_KEEPER,
        contractsCore.eth.moleculaPool,
        config.APY_FORMATTER.toString(),
    ]);

    const INITIAL_SHARES_SUPPLY = hre.ethers.parseUnits(config.INITIAL_USDT_SUPPLY.toString(), 12);

    await verifyContract(hre, 'RebaseToken', contractsNitrogen.eth.rebaseToken, [
        account.address,
        contractsNitrogen.eth.accountantAgent,
        INITIAL_SHARES_SUPPLY,
        contractsNitrogen.eth.supplyManager,
        config.MUSD_TOKEN_NAME,
        config.MUSD_TOKEN_SYMBOL,
        config.MUSD_TOKEN_DECIMALS,
        config.MUSD_TOKEN_MIN_DEPOSIT,
        config.MUSD_TOKEN_MIN_REDEEM,
    ]);

    if (contractsNitrogen.eth.rebaseTokenOwner !== '') {
        await verifyContract(hre, 'RebaseTokenOwner', contractsNitrogen.eth.rebaseTokenOwner, [
            config.OWNER,
            contractsNitrogen.eth.rebaseToken,
            config.GUARDIAN_ADDRESS,
        ]);
    }

    for (const tokenVault of Object.values(contractsNitrogen.eth.tokenVaults)) {
        await verifyContract(hre, 'NitrogenTokenVault', tokenVault as string, [
            account.address, // Note: the owner is not deploy wallet
            contractsNitrogen.eth.rebaseToken,
            contractsNitrogen.eth.supplyManager,
            contractsNitrogen.eth.rebaseTokenOwner,
            config.GUARDIAN_ADDRESS,
            ethers.ZeroAddress,
        ]);
    }

    if (contractsNitrogen.eth.wmUSD !== '') {
        await verifyContract(hre, 'WMUSD', contractsNitrogen.eth.wmUSD, [
            config.WMUSD_TOKEN_NAME,
            config.WMUSD_TOKEN_SYMBOL,
            config.OWNER,
            contractsNitrogen.eth.rebaseToken,
            contractsNitrogen.eth.lmUSD,
        ]);
    }
    if (contractsNitrogen.eth.lmUSD !== '') {
        await verifyContract(hre, 'LMUSD', contractsNitrogen.eth.lmUSD, [
            config.LMUSD_TOKEN_NAME,
            config.LMUSD_TOKEN_SYMBOL,
            config.OWNER,
            contractsNitrogen.eth.rebaseToken,
            contractsNitrogen.eth.wmUSD,
            config.LMUSD_PERIODS,
            config.LMUSD_MULTIPLIERS,
        ]);
    }

    if (contractsNitrogen.eth.rebaseTokenOwner !== '') {
        await verifyContract(hre, 'RebaseTokenOwner', contractsNitrogen.eth.rebaseTokenOwner, [
            config.OWNER, // Note: the owner is not deploy wallet
            contractsNitrogen.eth.rebaseToken,
            config.GUARDIAN_ADDRESS,
        ]);
    }
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
