/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Types } from 'tronweb';

import type { Hex } from '@molecula-monorepo/common.evm-utilities';

import type { TypedContractEvent as CommonTypedContractEvent } from '@molecula-monorepo/common.tron-contracts';
import type { TypedContractEvent } from '@molecula-monorepo/solidity/typechain-types/common';

import type { TronSubscriber } from '../../tron';

import type { TronAddress, InternalTronEvent } from '../../types';

import type { LoadEventsFilter } from './events';

import type { BigIntToString } from './utils';

type AnyFunction = () => void;
type PickAnyFunctions<T> = { [K in keyof T as T[K] extends AnyFunction ? K : never]: T[K] };

export type TronSafeViewCall<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    method: Method,
    ...args: Parameters<Contract[Method]>
) => Promise<Awaited<ReturnType<Contract[Method]>>>;

export type TronSafeTxCall<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    method: Method,
    ...args: Parameters<Contract[Method]>
) => Promise<Hex>;

export type TronSafePayableTxCall<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    method: Method,
    value: bigint,
    ...args: Parameters<Contract[Method]>
) => Promise<Hex>;

export type CreateTxData = {
    fromAddress: TronAddress;
    feeLimit?: number | undefined;
    callValue?: number | undefined;
};

export type TronSafeParams = {
    parameters: {
        type: string;
        value: unknown;
    }[];
    selectorTypes: string[];
};

export type TronSafeBuildParams<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    createData: CreateTxData,
    method: Method,
    ...args: Parameters<Contract[Method]>
) => TronSafeParams;

export type TronSafeCreateTx<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    createData: CreateTxData,
    method: Method,
    ...args: Parameters<Contract[Method]>
) => Promise<Types.Transaction<Types.TriggerSmartContract>>;

export type TronSafeEstimateEnergy<Contract extends PickAnyFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    createData: CreateTxData,
    method: Method,
    ...args: Parameters<Contract[Method]>
) => Promise<string>;

type GetEventResult<
    Event extends
        | TypedContractEvent<any, never, never>
        | CommonTypedContractEvent<any, never, never>,
> = (Event extends TypedContractEvent<never, never, infer OutputObject> ? OutputObject : never) &
    (Event extends CommonTypedContractEvent<never, never, infer OutputObject>
        ? OutputObject
        : never);

type FilterContractBase = {
    filters: Record<string, TypedContractEvent | CommonTypedContractEvent>;
};

export type TronSafeSubscriber<Contract extends FilterContractBase> = <
    FilterName extends keyof Contract['filters'],
>(
    filterName: FilterName,
    callback: (
        error?: object,
        event?: InternalTronEvent<
            FilterName,
            BigIntToString<GetEventResult<Contract['filters'][FilterName]>>
        >,
    ) => Promise<void>,
) => Promise<TronSubscriber>;

export type TronSafeEventsLoad<Contract extends FilterContractBase> = <
    FilterName extends keyof Contract['filters'],
>(
    filterName: FilterName,
    filterOptions?: LoadEventsFilter | null,
) => Promise<
    InternalTronEvent<FilterName, BigIntToString<GetEventResult<Contract['filters'][FilterName]>>>[]
>;
