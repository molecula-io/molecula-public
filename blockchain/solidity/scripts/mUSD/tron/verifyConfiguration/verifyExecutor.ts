/*
 * Executor Contract Verification Module for Tron
 *
 * This module contains functions for verifying Executor contract configuration
 * on Tron networks. It checks LayerZero endpoint, priceFeed, workerFeeLib,
 * and dstConfig parameters, comparing dstConfig with LayerZero Executor contract.
 */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Contract as TronContract } from 'tronweb';

import type { ContractsExecutor } from '@molecula-monorepo/blockchain.addresses';

import { SMALL_DELAY, DOUBLE_DELAY } from '../../../../configs';
import type { TronNetworkConfig } from '../../../../configs/mUSD/tron/types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { addDelay, toBase58, checkValue } from '../../../utils/configurationVerificationUtils';

import { verifyDstConfig } from './verifyDstConfig';

/**
 * Verifies Executor Tron contract configuration
 */
export async function verifyExecutorContract(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: TronNetworkConfig,
    contracts: ContractsExecutor,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying Executor Tron contract: ${contractAddress}`);

    // Normalize Executor address for TronWeb (accepts base58). If hex 0x.. is provided, convert to base58.
    let tronExecutorAddress = contractAddress;
    if (tronExecutorAddress && tronExecutorAddress.startsWith('0x')) {
        const hex41 = tronExecutorAddress.replace(/^0x/, '41');
        tronExecutorAddress = hre.tronweb.address.fromHex(hex41);
    }
    const artifact = await hre.artifacts.readArtifact('Executor');
    const executor = hre.tronweb.contract(artifact.abi, tronExecutorAddress) as TronContract;

    const results: VerificationResult[] = [];

    // Verify ENDPOINT
    const endpointRaw = await executor.methods.ENDPOINT?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    const endpoint = toBase58(String(endpointRaw), hre);
    results.push({
        variableName: 'ENDPOINT',
        ...checkValue(config.LAYER_ZERO_TRON_ENDPOINT, endpoint),
    });

    // Verify LOCAL_EID_V2
    const localEidV2 = await executor.methods.LOCAL_EID_V2?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'LOCAL_EID_V2',
        ...checkValue(config.LAYER_ZERO_TRON_EID, localEidV2),
    });

    // Verify RECEIVE_ULN302
    const receiveUln302Raw = await executor.methods.RECEIVE_ULN302?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    const receiveUln302 = toBase58(String(receiveUln302Raw), hre);
    results.push({
        variableName: 'RECEIVE_ULN302',
        ...checkValue(config.LAYER_ZERO_RECEIVE_ULN_LIB, receiveUln302),
    });

    // Verify priceFeed
    const priceFeedRaw = await executor.methods.priceFeed?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    const priceFeed = toBase58(String(priceFeedRaw), hre);
    results.push({
        variableName: 'priceFeed',
        ...checkValue(config.LAYER_ZERO_PRICE_FEED, priceFeed),
    });

    // Verify workerFeeLib
    const workerFeeLibRaw = await executor.methods.workerFeeLib?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    const workerFeeLib = toBase58(String(workerFeeLibRaw), hre);
    results.push({
        variableName: 'workerFeeLib',
        ...checkValue(contracts.tron.executorFeeLib, workerFeeLib),
    });

    // Verify defaultMultiplierBps
    const defaultMultiplierBps = await executor.methods.defaultMultiplierBps?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'defaultMultiplierBps',
        ...checkValue(12000, defaultMultiplierBps),
    });

    // Verify allowlistSize
    const allowlistSize = await executor.methods.allowlistSize?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'allowlistSize',
        ...checkValue(0, allowlistSize),
    });

    // Verify dstConfig for Ethereum EID by comparing with LayerZero executor
    await verifyDstConfig(
        hre,
        executor,
        config.LAYER_ZERO_ETHEREUM_EID,
        config.LAYER_ZERO_TRON_EXECUTOR,
        results,
    );
    await addDelay(DOUBLE_DELAY); // Additional delay after dstConfig verification

    // Verify roles (DEFAULT_ADMIN_ROLE, ADMIN_ROLE, MESSAGE_LIB_ROLE)

    // Compute role hashes via ethers utils
    const DEFAULT_ADMIN_ROLE = await executor.methods.DEFAULT_ADMIN_ROLE?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    const ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ADMIN_ROLE'));
    const MESSAGE_LIB_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('MESSAGE_LIB_ROLE'));

    // OWNER from config should be default admin
    const ownerIsDefaultAdmin = await executor.methods
        .hasRole?.(DEFAULT_ADMIN_ROLE, config.OWNER)
        .call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'hasRole(DEFAULT_ADMIN_ROLE, OWNER)',
        ...checkValue(true, ownerIsDefaultAdmin),
    });

    // OWNER should also have ADMIN_ROLE (constructor grants from _admins array)
    const ownerIsAdmin = await executor.methods.hasRole?.(ADMIN_ROLE, config.OWNER).call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'hasRole(ADMIN_ROLE, OWNER)',
        ...checkValue(true, ownerIsAdmin),
    });

    // SEND ULN LIB should have MESSAGE_LIB_ROLE
    const sendLibHasMsgRole = await executor.methods
        .hasRole?.(MESSAGE_LIB_ROLE, config.LAYER_ZERO_SEND_ULN_LIB)
        .call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'hasRole(MESSAGE_LIB_ROLE, SEND_ULN_LIB)',
        ...checkValue(true, sendLibHasMsgRole),
    });

    return {
        contractAddress,
        contractName: 'Executor',
        results,
    };
}
