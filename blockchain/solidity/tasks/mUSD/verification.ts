/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import type { EVMAddress } from '@molecula-monorepo/blockchain.addresses';
import type {
    ContractsCarbon,
    ContractsCore,
    ContractsNitrogen,
} from '@molecula-monorepo/blockchain.addresses/deploy';

import {
    getEnvironment,
    handleError,
    readFromFile,
    getEnvironmentConfig,
} from '../../scripts/utils/deployUtils';
import { verifyContract } from '../../scripts/verificationUtils';

const verificationScope = scope('verificationScope', 'Scope for contract verification tasks');

verificationScope
    .task('verifyCarbon', 'Verify Carbon configuration')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Contract Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const config = getEnvironmentConfig(environment);
            const contractsConfig: ContractsCarbon = await readFromFile(
                `${environment}/contracts_carbon.json`,
            );

            const account = (await hre.ethers.getSigners())[0]!;

            await verifyContract(hre, 'AgentLZ', contractsConfig.eth.agentLZ, [
                account.address,
                account.address,
                config.LAYER_ZERO_ENDPOINT,
                contractsConfig.eth.supplyManager,
                config.LAYER_ZERO_TRON_EID,
                config.USDT_ADDRESS,
                config.USDT_OFT,
            ]);

            console.log('Carbon verification completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

verificationScope
    .task('verifyNitrogen', 'Verify Nitrogen configuration')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Contract Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const config = getEnvironmentConfig(environment);
            const contractsCore: ContractsCore = await readFromFile(
                `${environment}/contracts_core.json`,
            );
            const contractsNitrogen: ContractsNitrogen = await readFromFile(
                `${environment}/contracts_nitrogen.json`,
            );

            const account = (await hre.ethers.getSigners())[0]!;

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

            await verifyContract(
                hre,
                'MoleculaPoolTreasuryV2',
                contractsNitrogen.eth.moleculaPool,
                [
                    account.address,
                    tokens.map(x => x.token),
                    contractsNitrogen.eth.poolKeeper,
                    contractsNitrogen.eth.supplyManager,
                    config.WHITE_LIST,
                    config.GUARDIAN_ADDRESS,
                ],
            );

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

            const INITIAL_SHARES_SUPPLY = hre.ethers.parseUnits(
                config.INITIAL_USDT_SUPPLY.toString(),
                12,
            );

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
                await verifyContract(
                    hre,
                    'RebaseTokenOwner',
                    contractsNitrogen.eth.rebaseTokenOwner,
                    [config.OWNER, contractsNitrogen.eth.rebaseToken, config.GUARDIAN_ADDRESS],
                );
            }

            // eslint-disable-next-line no-restricted-syntax
            for (const tokenVault of Object.values(contractsNitrogen.eth.tokenVaults)) {
                // eslint-disable-next-line no-await-in-loop
                await verifyContract(hre, 'NitrogenTokenVault', tokenVault as string, [
                    account.address, // Note: the owner is not deploy wallet
                    contractsNitrogen.eth.rebaseToken,
                    contractsNitrogen.eth.supplyManager,
                    contractsNitrogen.eth.rebaseTokenOwner,
                    config.GUARDIAN_ADDRESS,
                    hre.ethers.ZeroAddress,
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
                await verifyContract(
                    hre,
                    'RebaseTokenOwner',
                    contractsNitrogen.eth.rebaseTokenOwner,
                    [
                        config.OWNER, // Note: the owner is not deploy wallet
                        contractsNitrogen.eth.rebaseToken,
                        config.GUARDIAN_ADDRESS,
                    ],
                );
            }

            console.log('Nitrogen verification completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });

verificationScope
    .task('verifyExecutor', 'Verify Executor configuration')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Contract Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        try {
            const config = getEnvironmentConfig(environment);
            const contractsExecutor = await readFromFile(`${environment}/contracts_executor.json`);

            const account = (await hre.ethers.getSigners())[0]!;

            await verifyContract(hre, 'ExecutorFeeLib', contractsExecutor.eth.executorFeeLib, [
                config.LAYER_ZERO_ETHEREUM_EID,
                hre.ethers.parseEther('1'),
            ]);

            await verifyContract(hre, 'Executor', contractsExecutor.eth.executor, [
                config.LAYER_ZERO_ENDPOINT,
                config.LAYER_ZERO_RECEIVE_ULN_LIB,
                [config.LAYER_ZERO_SEND_ULN_LIB],
                config.LAYER_ZERO_PRICE_FEED,
                account.address,
                [account.address],
            ]);

            console.log('Executor verification completed successfully.');
        } catch (error) {
            handleError(error);
        }
    });
