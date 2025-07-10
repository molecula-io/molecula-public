import type { TronWeb, ContractAbiInterface } from 'tronweb';

import type { SunCurve, TRC20, ReceiveULN } from '@molecula-monorepo/common.tron-contracts';
import type { UsdtOFT, Executor } from '@molecula-monorepo/solidity/typechain-types';
import type { ILayerZeroEndpointV2 } from '@molecula-monorepo/solidity/typechain-types/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces';

import type { MUSDLock } from '@molecula-monorepo/solidity/typechain-types/contracts/common/mUSDLock.sol';
import type { RebaseTokenCommon as RebaseToken } from '@molecula-monorepo/solidity/typechain-types/contracts/common/rebase';
import type {
    AccountantLZ,
    TronOracle as Oracle,
} from '@molecula-monorepo/solidity/typechain-types/contracts/solutions/Carbon/tron';

export type AllTronContracts =
    | RebaseToken
    | MUSDLock
    | Oracle
    | AccountantLZ
    | TRC20
    | ILayerZeroEndpointV2
    | SunCurve
    | UsdtOFT
    | Executor
    | ReceiveULN;

export type TronContractParams = {
    client: TronWeb;
    contractAddress: string;
    abi: ContractAbiInterface;
    apiUrl?: string | undefined;
};
