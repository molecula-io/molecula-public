import BigNumber from 'bignumber.js';

import type { ContractRunner, ContractTransaction, JsonFragment, Provider } from 'ethers';

import { type DecodedError, ErrorDecoder } from 'ethers-decode-error';

import {
    evmQueue,
    waitForEthereumTransaction,
    type Hex,
} from '@molecula-monorepo/common.evm-utilities';

import { jsonStringifyBigint } from '@molecula-monorepo/common.shared';

import type { TypedContractMethod } from '../types';

import { allContractAbi } from './allContractAbi';

import { SafeCallError, parseError } from './errors';

import type {
    EvmContractSafeCall,
    AllEvmContracts,
    EvmContractSafeViewCall,
    ProviderOrRunner,
} from './types';

/**
 * Create safe contract with contract factory
 */
type ContractFactory<T> = {
    /**
     * Factory for connect to contract
     */
    factory: {
        connect: (address: string, rpcProvider?: ContractRunner) => T;
        abi: readonly JsonFragment[];
    };

    /**
     * Contract address
     */
    address: string;
};

/**
 * Create safe contract with contract instance
 */
type ContractInstance<T> = {
    /**
     * Contract instance
     */
    instance: T;
    /**
     * Contract abi
     */
    abi: readonly JsonFragment[];
};

export class EvmContractSafe<Contract extends AllEvmContracts> {
    public readonly contract: Contract;

    private readonly rpcProvider: Provider;

    /**
     * Contract error decoder
     */
    protected errorDecoder: ErrorDecoder;

    public constructor(
        contract: ContractInstance<Contract> | ContractFactory<Contract>,
        providerOrRunner: ProviderOrRunner,
    ) {
        if (!providerOrRunner) {
            throw new SafeCallError(`Invalid rpcProvider`, {});
        }

        if ('factory' in contract) {
            this.contract = contract.factory.connect(contract.address, providerOrRunner);

            this.errorDecoder = ErrorDecoder.create([
                contract.factory.abi as JsonFragment[],
                ...allContractAbi,
            ]);
        } else {
            this.contract = contract.instance;

            this.errorDecoder = ErrorDecoder.create([
                contract.abi as JsonFragment[],
                ...allContractAbi,
            ]);
        }

        if ('provider' in providerOrRunner) {
            const runner = providerOrRunner as ContractRunner;
            this.rpcProvider = runner.provider as Provider;
        } else {
            this.rpcProvider = providerOrRunner as Provider;
        }
    }

    private checkCall: EvmContractSafeCall<Contract, void> = async (
        method,
        ...args
    ): Promise<void> => {
        const contractMethod = this.contract[method] as TypedContractMethod;
        const methodName: string = method as string;

        if (!contractMethod || !('staticCall' in contractMethod)) {
            throw new SafeCallError(`Unknown contract method: ${methodName}`, {
                method: methodName,
                args: JSON.parse(jsonStringifyBigint(args)),
            });
        }

        try {
            await contractMethod.staticCall(...args);
        } catch (error) {
            let decodedError: DecodedError | null;
            let reason;
            try {
                decodedError = await this.decodeError(error);
                ({ reason } = decodedError);
            } catch (_) {
                decodedError = null;
                reason = error.message;
            }

            const errorMessage = `Failed contract call: ${reason}`;

            throw new SafeCallError(errorMessage, {
                method: methodName,
                args: JSON.parse(jsonStringifyBigint(args)),
                decodedError: decodedError
                    ? {
                          reason: decodedError.reason,
                          data: decodedError.data,
                          type: decodedError.type,
                      }
                    : null,
            });
        }
    };

    public safeViewCall: EvmContractSafeViewCall<Contract> = async (method, ...args) => {
        const methodName = method as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contractMethod = this.contract[method] as TypedContractMethod<any, any, 'view'>;

        if (!contractMethod) {
            throw new SafeCallError(`Unknown contract method: ${methodName}`, {
                method: methodName,
                args: JSON.parse(jsonStringifyBigint(args)),
            });
        }

        try {
            return evmQueue.add(() => contractMethod(...args));
        } catch (error) {
            throw new SafeCallError(
                'Fail evm safe view call',
                {
                    method: method as string,
                    args: JSON.parse(jsonStringifyBigint(args)),
                },
                parseError(error),
            );
        }
    };

    /**
     * Safely calling a contract method
     * First, the staticCall method is called,
     * if there were no errors, then the send method is called.
     * @param method - Method name
     * @param args - Method arguments
     */
    public safeCall: EvmContractSafeCall<Contract, Hex> = async (method, ...args): Promise<Hex> => {
        await this.checkCall(method, ...args);

        const contractMethod = this.contract[method] as TypedContractMethod;

        const response = await evmQueue.addSingle(() => contractMethod(...args));

        const hash = response.hash as Hex;

        try {
            await waitForEthereumTransaction(this.rpcProvider, hash);
        } catch (error) {
            throw new SafeCallError(
                `Failed wait transaction: ${error.message}`,
                {
                    method: method as string,
                    args: JSON.parse(jsonStringifyBigint(args)),
                },
                parseError(error),
            );
        }

        return hash;
    };

    /**
     * Safely populate transaction to call contract method
     * First, the staticCall method is called,
     * if there were no errors, then create transaction for sign.
     * @param method - Method name
     * @param args - Method arguments
     */
    public safePopulateTransaction: EvmContractSafeCall<Contract, ContractTransaction> = async (
        method,
        ...args
    ): Promise<ContractTransaction> => {
        await this.checkCall(method, ...args);

        const contractMethod = this.contract[method] as TypedContractMethod;

        return contractMethod.populateTransaction(...args);
    };

    /**
     * Estimate gas of contract method
     * @param method - Method name
     * @param args - Method arguments
     * @returns human readable error reason
     */
    public estimateGas: EvmContractSafeCall<Contract, string> = async (
        method,
        ...args
    ): Promise<string> => {
        try {
            const contractMethod = this.contract[method] as TypedContractMethod;
            const gas = await contractMethod.estimateGas(...args);

            const feeData = await this.rpcProvider.getFeeData();

            return new BigNumber(gas.toString())
                .multipliedBy((feeData.maxFeePerGas ?? 0).toString())
                .toString();
        } catch (error) {
            let decodedError: DecodedError | null;
            let reason;
            try {
                decodedError = await this.decodeError(error);
                ({ reason } = decodedError);
            } catch (_) {
                decodedError = null;
                reason = error.message;
            }

            const errorMessage = `Failed contract call: ${reason}`;

            throw new SafeCallError(errorMessage, {
                method: method as string,
                args: JSON.parse(jsonStringifyBigint(args)),
                decodedError: decodedError
                    ? {
                          reason: decodedError.reason,
                          data: decodedError.data,
                          type: decodedError.type,
                      }
                    : null,
            });
        }
    };

    /**
     * Decode information about contract call error
     * @param error - error by contract
     * @returns human readable error reason
     */
    public async decodeError(error: unknown): Promise<DecodedError> {
        return this.errorDecoder.decode(error);
    }
}
