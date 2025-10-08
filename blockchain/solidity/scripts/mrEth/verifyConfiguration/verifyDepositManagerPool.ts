/*
 * DepositManagerPool Verification Module
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsMrEth } from '@molecula-monorepo/blockchain.addresses';

import type { mrEthNetworkConfig } from '../../../configs';
import type { ContractVerification } from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';

/**
 * Verifies DepositManagerPool contract configuration
 * Checks all essential contract parameters, roles, and configuration values
 */
export async function verifyDepositManagerPool(
    hre: HardhatRuntimeEnvironment,
    contractsMrEth: ContractsMrEth,
    config: mrEthNetworkConfig,
): Promise<ContractVerification> {
    const depositManagerPool = await hre.ethers.getContractAt(
        'DepositManagerPool',
        contractsMrEth.eth.depositManagerPool,
    );

    const report: ContractVerification = {
        contractAddress: contractsMrEth.eth.depositManagerPool,
        contractName: 'DepositManagerPool',
        results: [],
    };

    // Verify supply manager
    const supplyManager = await depositManagerPool.SUPPLY_MANAGER();
    report.results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contractsMrEth.eth.supplyManagerV2, supplyManager),
    });

    // Verify WETH
    const weth = await depositManagerPool.WETH();
    report.results.push({
        variableName: 'WETH',
        ...checkValue(config.WETH_ADDRESS, weth),
    });

    // Verify strategy factory
    const strategyFactory = await depositManagerPool.STRATEGY_FACTORY();
    report.results.push({
        variableName: 'STRATEGY_FACTORY',
        ...checkValue(config.STRATEGY_FACTORY, strategyFactory),
    });

    // Verify delegation manager
    const delegationManager = await depositManagerPool.DELEGATION_MANAGER();
    report.results.push({
        variableName: 'DELEGATION_MANAGER',
        ...checkValue(config.DELEGATION_MANAGER, delegationManager),
    });

    // Verify rewards coordinator
    const rewardsCoordinator = await depositManagerPool.REWARDS_COORDINATOR();
    report.results.push({
        variableName: 'REWARDS_COORDINATOR',
        ...checkValue(config.REWARDS_COORDINATOR, rewardsCoordinator),
    });

    // Verify deposit manager restaker
    const depositManagerRestaker = await depositManagerPool.DEPOSIT_MANAGER_RESTAKER();
    report.results.push({
        variableName: 'DEPOSIT_MANAGER_RESTAKER',
        ...checkValue(contractsMrEth.eth.depositManagerRestaker, depositManagerRestaker),
    });

    // Verify contract config
    const contractConfig = await depositManagerPool.config();

    // Verify buffer percentage
    report.results.push({
        variableName: 'bufferPercentage',
        ...checkValue(config.BUFFER_PERCENTAGE, contractConfig.bufferPercentage),
    });

    // Verify min fee percentage
    report.results.push({
        variableName: 'minFeePercentage',
        ...checkValue(config.MIN_FEE_PERCENTAGE, contractConfig.minFeePercentage),
    });

    // Verify max fee percentage
    report.results.push({
        variableName: 'maxFeePercentage',
        ...checkValue(config.MAX_FEE_PERCENTAGE, contractConfig.maxFeePercentage),
    });

    // Verify deposit manager lib
    report.results.push({
        variableName: 'depositManagerLib',
        ...checkValue(contractsMrEth.eth.depositManagerLib, contractConfig.depositManagerLib),
    });

    // Verify delegator implementation
    report.results.push({
        variableName: 'delegatorImplementation',
        ...checkValue(
            contractsMrEth.eth.delegatorImplementation,
            contractConfig.delegatorImplementation,
        ),
    });

    // Verify molecula buffer
    report.results.push({
        variableName: 'moleculaBuffer',
        ...checkValue(contractsMrEth.eth.moleculaBuffer, contractConfig.moleculaBuffer),
    });

    // Verify roles

    // Verify DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await depositManagerPool.DEFAULT_ADMIN_ROLE();
    const ownerIsDefaultAdmin = await depositManagerPool.hasRole(DEFAULT_ADMIN_ROLE, config.OWNER);
    report.results.push({
        variableName: 'hasRole(DEFAULT_ADMIN_ROLE, OWNER)',
        ...checkValue(true, ownerIsDefaultAdmin),
    });

    // Get AUTHORIZED_STAKER_ROLE
    const AUTHORIZED_STAKER_ROLE = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes('AUTHORIZED_STAKER_ROLE'),
    );

    // Verify AUTHORIZED_STAKER_ROLE
    const ownerIsAuthorizedStaker = await depositManagerPool.hasRole(
        AUTHORIZED_STAKER_ROLE,
        config.OWNER,
    );
    report.results.push({
        variableName: 'hasRole(AUTHORIZED_STAKER_ROLE, OWNER)',
        ...checkValue(true, ownerIsAuthorizedStaker),
    });

    // Get GUARDIAN_ROLE
    const GUARDIAN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('GUARDIAN_ROLE'));

    // Verify GUARDIAN_ROLE
    const isGuardian = await depositManagerPool.hasRole(GUARDIAN_ROLE, config.GUARDIAN);
    report.results.push({
        variableName: 'hasRole(GUARDIAN_ROLE, GUARDIAN)',
        ...checkValue(true, isGuardian),
    });

    return report;
}
