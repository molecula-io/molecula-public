import type { Signer, ContractInterface, AddressLike } from 'ethers';

// Type for Solidity function parameters
type SolidityParameter =
    | string
    | number
    | bigint
    | boolean
    | AddressLike
    | SolidityParameter[]
    | { [key: string]: SolidityParameter };

export async function callContractWithData(
    signer: Signer,
    contractAddress: AddressLike,
    encodeInterface: ContractInterface,
    functionName: string,
    data: SolidityParameter[],
    value: bigint = 0n,
) {
    if (!encodeInterface.encodeFunctionData) {
        throw new Error('Interface does not support encodeFunctionData');
    }

    const callData = await encodeInterface.encodeFunctionData(functionName, data);

    await signer.sendTransaction({
        to: contractAddress,
        data: callData,
        value,
    });
}

// Helper function to safely cast interface types
export function safeInterfaceCast(contractInterface: unknown): ContractInterface {
    return contractInterface as unknown as ContractInterface;
}
