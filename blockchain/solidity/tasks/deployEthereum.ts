import { scope } from 'hardhat/config';

import type { ContractsCore, ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import {
    deployAccountantAgent,
    deployCarbon,
    deployCore,
    deployMoleculaPoolTreasuryV2WithDerivedParams,
    deployNitrogen,
    deployExecutor,
    deployMrEth,
    deployMetaEth,
} from '../scripts/ethereum';
import { deployNitrogenTokenVault } from '../scripts/ethereum/deploy/deployNitrogenTokenVault';
import { deployRebaseTokenOwner } from '../scripts/ethereum/deploy/deployRebaseTokenOwner';
import { deploywmUSDlmUSD } from '../scripts/ethereum/deploy/deploywmUSDlmUSD';
import {
    getEnvironment,
    handleError,
    readFromFile,
    writeToFile,
} from '../scripts/utils/deployUtils';

const ethereumMajorScope = scope('ethereumScope', 'Scope for major ethereum deployment flow');

ethereumMajorScope
    .task('deployNitrogen', 'Deploys the Nitrogen contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsCore: ContractsCore = await readFromFile(
                `${environment}/contracts_core.json`,
            );
            const eth = await deployNitrogen(hre, environment, {
                mUSDe: contractsCore.eth.mUSDe,
                moleculaPool: contractsCore.eth.moleculaPool,
                supplyManager: contractsCore.eth.supplyManager,
            });
            const result = { eth };

            writeToFile(`${environment}/contracts_nitrogen.json`, result);
            console.log('Deployment and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

ethereumMajorScope
    .task('deployCore', 'Deploys the Core contracts')
    .addParam('environment', 'Deployment environment')
    .addFlag('nomusde', 'Deployment mUSDe flag')
    .setAction(async (taskArgs, hre) => {
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const eth = await deployCore(hre, environment, taskArgs.nomusde);
            const result = { eth };

            writeToFile(`${environment}/contracts_core.json`, result);
            console.log('Deployment and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

ethereumMajorScope
    .task('deployAccountantAgent', 'Deploys the AccountantAgent contract')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const result = await deployAccountantAgent(hre, environment);

            writeToFile(`${environment}/accountant_agent.json`, result);
            console.log('Deployment and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

ethereumMajorScope
    .task('deployMoleculaPoolTreasuryV2', 'Deploys the Nitrogen MoleculaPoolTreasuryV2 contract')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        const environment = getEnvironment(hre, taskArgs.environment);
        const result = await deployMoleculaPoolTreasuryV2WithDerivedParams(hre, environment);
        writeToFile(`${environment}/molecula_pool_treasuryV2.json`, {
            moleculaPoolV2: result.moleculaPoolV2,
        });
        console.log('Deployment and file write completed successfully.');
    });

ethereumMajorScope
    .task('deployCarbon', 'Deploys Carbon on Ethereum')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Ethereum Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            const contractsCore = await readFromFile(`${environment}/contracts_core.json`);
            const contractsCarbon = await readFromFile(`${environment}/contracts_carbon.json`);

            // Execute deployment
            const data = await deployCarbon(hre, environment, {
                supplyManagerAddress: contractsCore.eth.supplyManager,
                moleculaPoolAddress: contractsCore.eth.moleculaPool,
            });
            const eth = {
                ...data,
                ethena: contractsCore.eth.ethena,
                mUSDe: contractsCore.eth.mUSDe,
            };

            writeToFile(`${environment}/contracts_carbon.json`, {
                eth,
                tron: contractsCarbon.tron,
            });
            console.log('Deployment and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

ethereumMajorScope
    .task('deploywmUSDlmUSD', 'Deploys wmUSD and lmUSD contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        const contractsNitrogen: ContractsNitrogen = await readFromFile(
            `${environment}/contracts_nitrogen.json`,
        );

        const contracts = await deploywmUSDlmUSD(
            hre,
            environment,
            contractsNitrogen.eth.rebaseToken,
        );
        contractsNitrogen.eth.wmUSD = contracts.wmUSD;
        contractsNitrogen.eth.lmUSD = contracts.lmUSD;

        writeToFile(`${environment}/contracts_nitrogen.json`, contractsNitrogen);
        console.log('Deployment and file write completed successfully.');
    });

ethereumMajorScope
    .task('deployExecutor', 'Deploys LZ Executor contract on Ethereum')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsExecutor = await readFromFile(`${environment}/contracts_executor.json`);
            const result = await deployExecutor(hre, environment);

            writeToFile(`${environment}/contracts_executor.json`, {
                eth: result.eth,
                tron: contractsExecutor.tron,
            });
            console.log('Deployment of LZ Executor contract completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

ethereumMajorScope
    .task('deployRebaseTokenOwner', 'Deploys RebaseTokenOwner contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        const contractsNitrogen: ContractsNitrogen = await readFromFile(
            `${environment}/contracts_nitrogen.json`,
        );

        contractsNitrogen.eth.rebaseTokenOwner = await deployRebaseTokenOwner(hre, environment);
        writeToFile(`${environment}/contracts_nitrogen.json`, contractsNitrogen);
    });

ethereumMajorScope
    .task('deployNitrogenTokenVault', 'Deploys NitrogenTokenVault contract')
    .addParam('environment', 'Deployment environment')
    .addParam('token', 'ERC20 token address')
    .addParam('tokenName', 'Token name')
    .addParam('minDeposit', 'Minimal deposit assets')
    .addParam('minRedeem', 'Minimal redeem shares')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        console.log('token:', taskArgs.token);
        console.log('tokenName:', taskArgs.tokenName);
        console.log('minDeposit:', taskArgs.minDeposit);
        console.log('minRedeem:', taskArgs.minRedeem);

        const environment = getEnvironment(hre, taskArgs.environment);
        const contractsNitrogen: ContractsNitrogen = await readFromFile(
            `${environment}/contracts_nitrogen.json`,
        );

        const nitrogenTokenVault = await deployNitrogenTokenVault(
            hre,
            environment,
            taskArgs.token,
            taskArgs.minDeposit,
            taskArgs.minRedeem,
        );
        // @ts-ignore
        contractsNitrogen.eth.tokenVaults[taskArgs.tokenName] = nitrogenTokenVault;

        writeToFile(`${environment}/contracts_nitrogen.json`, contractsNitrogen);
    });

ethereumMajorScope
    .task('deployMrEth', 'Deploys mrETH and core V2 contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        const deployedMrEth = await deployMrEth(hre, environment);

        const contractsMrEth = await readFromFile(`${environment}/contracts_mr_eth.json`);

        if (hre.network.name === 'holesky') {
            contractsMrEth.holesky = deployedMrEth;
        } else {
            contractsMrEth.eth = deployedMrEth;
        }

        writeToFile(`${environment}/contracts_mr_eth.json`, contractsMrEth);
        console.log('Deployment and file write completed successfully.');
    });

ethereumMajorScope
    .task('deployMetaEth', 'Deploys MetaEth and core V2 contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        const result = {
            eth: await deployMetaEth(hre, environment),
        };

        writeToFile(`${environment}/contracts_meta_eth.json`, result);
    });
