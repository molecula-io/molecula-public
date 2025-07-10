import {
    type DevnetContractsCore,
    type DevnetContractsNitrogen,
    type DevnetContractsCarbon,
    type DevnetContractsMrEth,
    type DevnetContractsMetaEth,
} from './devnet';
import {
    type MainBetaContractsCarbon,
    type MainBetaContractsCore,
    type MainBetaContractsNitrogen,
    type MainBetaContractsMrEth,
    type MainBetaContractsMetaEth,
} from './mainnet/beta';
import {
    type MainProdContractsCarbon,
    type MainProdContractsCore,
    type MainProdContractsNitrogen,
    type MainProdContractsMrEth,
    type MainProdContractsMetaEth,
} from './mainnet/prod';

export * from './devnet';
export * from './mainnet/beta';
export * from './mainnet/prod';

export type ContractsCore =
    | typeof DevnetContractsCore
    | typeof MainBetaContractsCore
    | typeof MainProdContractsCore;

export type ContractsNitrogen =
    | typeof DevnetContractsNitrogen
    | typeof MainBetaContractsNitrogen
    | typeof MainProdContractsNitrogen;

export type ContractsCarbon =
    | typeof DevnetContractsCarbon
    | typeof MainBetaContractsCarbon
    | typeof MainProdContractsCarbon;

export type ContractsMrEth =
    | typeof DevnetContractsMrEth
    | typeof MainBetaContractsMrEth
    | typeof MainProdContractsMrEth;

export type ContractsMetaEth =
    | typeof DevnetContractsMetaEth
    | typeof MainBetaContractsMetaEth
    | typeof MainProdContractsMetaEth;
