/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import type { HardhatNetworkHDAccountsConfig } from 'hardhat/types/config';

import type { ContractsCarbon } from '@molecula-monorepo/blockchain.addresses';

import { deployCarbon } from '../scripts/tron/deploy/deployCarbonTron';
import { deployExecutor } from '../scripts/tron/deploy/deployExecutor';
import { deployMockUSDT, deployUsdtOFT } from '../scripts/tron/deploy/deployMockTron';
import { migrateAccountantLZwithOracle } from '../scripts/tron/migration/migrateAccountantLZwithOracle';
import {
    handleError,
    writeToFile,
    readFromFile,
    getEnvironment,
} from '../scripts/utils/deployUtils';

const tronMajorScope = scope('tronScope', 'Scope for major ethereum deployment flow');

tronMajorScope
    .task('deployCarbon', 'Deploys Carbon on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsCarbon: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            // Execute deployment
            const tron = await deployCarbon(hre, accounts.mnemonic, accounts.path, environment);

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
    .task('migrateAccountantLZwithOracle', 'Migrates Carbon AccountantLZ with Oracle on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const contractsCarbon: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            // Execute deployment
            const tron = await migrateAccountantLZwithOracle(
                hre,
                accounts.mnemonic,
                accounts.path,
                environment,
            );

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
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            // Execute deployment
            await deployMockUSDT(hre, accounts.mnemonic, accounts.path, environment);

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

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            // Execute deployment
            await deployUsdtOFT(hre, accounts.mnemonic, accounts.path, environment);

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

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);
        try {
            const contractsExecutor = await readFromFile(`${environment}/contracts_executor.json`);
            // Execute deployment
            const executor = await deployExecutor(
                hre,
                accounts.mnemonic,
                accounts.path,
                environment,
            );
            writeToFile(`${environment}/contracts_executor.json`, {
                eth: contractsExecutor.eth,
                tron: executor.tron,
            });

            console.log('Deployment of LZ Executor contract completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });
