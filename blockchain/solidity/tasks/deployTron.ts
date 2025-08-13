/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import type { ContractsCarbon } from '@molecula-monorepo/blockchain.addresses';

import {
    deployCarbon,
    deployExecutor,
    deployMockUSDT,
    deployUsdtOFT,
    deploywmUSD,
    deployRebaseTokenOwner,
    deployOFTVault,
} from '../scripts/tron/deploy';
import { migrateAccountantLZwithOracle } from '../scripts/tron/migration/migrateAccountantLZwithOracle';
import {
    getEnvironment,
    handleError,
    readFromFile,
    writeToFile,
} from '../scripts/utils/deployUtils';

const tronMajorScope = scope('tronScope', 'Scope for major ethereum deployment flow');

tronMajorScope
    .task('deployCarbon', 'Deploys Carbon on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsCarbon: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            // Execute deployment
            const tron = await deployCarbon(hre, environment);

            writeToFile(`${environment}/contracts_carbon.json`, {
                eth: contractsCarbon.eth,
                tron: tron.tron,
            });

            console.log('Deployment and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

tronMajorScope
    .task('deployRebaseTokenOwner', 'Deploys RebaseTokenOwner contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        const contractsCarbon: ContractsCarbon = await readFromFile(
            `${environment}/contracts_carbon.json`,
        );

        contractsCarbon.tron.rebaseTokenOwner = await deployRebaseTokenOwner(
            hre,
            contractsCarbon,
            environment,
        );
        writeToFile(`${environment}/contracts_carbon.json`, contractsCarbon);
    });

tronMajorScope
    .task('migrateAccountantLZwithOracle', 'Migrates Carbon AccountantLZ with Oracle on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsCarbon: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            // Execute deployment
            const tron = await migrateAccountantLZwithOracle(hre, environment);

            writeToFile(`${environment}/contracts_carbon.json`, {
                eth: contractsCarbon.eth,
                tron: {
                    ...contractsCarbon.tron,
                    ...tron.tron,
                },
            });

            console.log('Migration and file write completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

tronMajorScope
    .task('deployUsdtMock', 'Deploys USDT mock contract on Tron')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        try {
            // Execute deployment
            await deployMockUSDT(hre);

            console.log('Deployment USDT Mock completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

tronMajorScope
    .task('deployUsdtOFT', 'Deploys UsdtOFT mock contract on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            // Execute deployment
            await deployUsdtOFT(hre, environment);

            console.log('Deployment UsdtOFT mock completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

tronMajorScope
    .task('deployExecutor', 'Deploys LZ Executor contract on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            const contractsExecutor = await readFromFile(`${environment}/contracts_executor.json`);
            // Execute deployment
            const executor = await deployExecutor(hre, environment);
            writeToFile(`${environment}/contracts_executor.json`, {
                eth: contractsExecutor.eth,
                tron: executor.tron,
            });

            console.log('Deployment of LZ Executor contract completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

tronMajorScope
    .task('deploywmUSD', 'Deploys wmUSD (Candy) on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        const contractsCarbon: ContractsCarbon = await readFromFile(
            `${environment}/contracts_carbon.json`,
        );

        // Execute deployment
        contractsCarbon.tron.wmUSD = await deploywmUSD(hre, contractsCarbon, environment);

        writeToFile(`${environment}/contracts_carbon.json`, contractsCarbon);
    });

tronMajorScope
    .task('deployOFTVault', 'Deploys OFTVault contract')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            const contractsCarbon: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            // Execute deployment
            const oftVaultAddress = await deployOFTVault(hre, contractsCarbon, environment);

            writeToFile(`${environment}/contracts_executor.json`, {
                ...contractsCarbon,
                tron: {
                    ...contractsCarbon.tron,
                    oftVault: oftVaultAddress,
                },
            });
            console.log('Deployment of TronOFTVault contract completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });
