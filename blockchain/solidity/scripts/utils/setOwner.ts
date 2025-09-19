/* eslint-disable no-await-in-loop, no-restricted-syntax, @typescript-eslint/no-explicit-any */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from './deployUtils';

export async function setOwner(
    hre: HardhatRuntimeEnvironment,
    contracts: { name: string; addr: string }[],
    newOwner: string,
) {
    const account = (await hre.ethers.getSigners())[0]!;
    console.log(`Setting owner ${newOwner} for the contracts:`);

    const contractsRequiringAcceptance: string[] = [];

    for (const contract of contracts) {
        const ownableContract = await hre.ethers.getContractAt(
            '@openzeppelin/contracts/access/Ownable.sol:Ownable',
            contract.addr,
        );
        // @ts-ignore
        const currentOwner = await ownableContract.owner();
        if (currentOwner === newOwner) {
            console.log(
                `\tContract ${contract.name} ${contract.addr} already has this owner. Skipped.`,
            );
        } else if (currentOwner === account.address) {
            // @ts-ignore
            const response = await ownableContract.transferOwnership(newOwner);
            await response.wait();
            console.log(`\tSet owner for contract ${contract.name} ${contract.addr}.`);

            // Check if this contract requires ownership acceptance by testing for pendingOwner function
            try {
                // Try to call pendingOwner() - if it exists, this is an Ownable2Step contract
                const ownable2StepContract = await hre.ethers.getContractAt(
                    '@openzeppelin/contracts/access/Ownable2Step.sol:Ownable2Step',
                    contract.addr,
                );
                // @ts-ignore
                await ownable2StepContract.pendingOwner.staticCall();
                // If we get here, the contract has pendingOwner function (Ownable2Step)
                contractsRequiringAcceptance.push(`${contract.name} (${contract.addr})`);
            } catch (error) {
                // Contract doesn't have pendingOwner function (regular Ownable)
                // This is expected for contracts that don't use Ownable2Step
            }
        } else {
            throw Error(
                `\tContract ${contract.name} ${contract.addr} has ${currentOwner} owner. It's impossible to change the owner.`,
            );
        }
    }

    // Display warning for contracts requiring ownership acceptance
    if (contractsRequiringAcceptance.length > 0) {
        console.log(
            '\n⚠️  WARNING: The following contracts use 2-step ownership and require the new owner to accept ownership:',
        );
        contractsRequiringAcceptance.forEach(contract => {
            console.log(`\t- ${contract}`);
        });
        console.log(
            `\n📝 The new owner (${newOwner}) must call acceptOwnership() on these contracts to complete the ownership transfer.`,
        );
        console.log(
            '💡 Until acceptOwnership() is called, the current owner retains control of these contracts.\n',
        );
    }
}

export async function setTronOwner(
    hre: HardhatRuntimeEnvironment,
    network: EnvironmentType,
    contracts: { name: string; addr: string }[],
    newOwner: string,
) {
    const config = getTronEnvironmentConfig(network);

    // get owner
    const initialOwner = hre.tronweb.defaultAddress.base58;
    console.log('Initial owner:', initialOwner);

    console.log(`Setting owner ${config.OWNER} for the contracts:`);

    const contractsRequiringAcceptance: string[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const contract of contracts) {
        // Get ABI
        const artifact = await hre.artifacts.readArtifact(
            '@openzeppelin/contracts/access/Ownable.sol:Ownable',
        );

        const ownableContract = hre.tronweb.contract(artifact.abi, contract.addr);
        const currentOwner = hre.tronweb.address.fromHex(await ownableContract.owner().call());
        if (currentOwner === newOwner) {
            console.log(
                `\tContract ${contract.name} ${contract.addr} has already the owner. Skipped.`,
            );
        } else if (currentOwner === initialOwner) {
            await ownableContract.transferOwnership(newOwner).send();
            console.log(`\tSet owner for contract ${contract.name} ${contract.addr}.`);

            // Check if this contract requires ownership acceptance by testing for pendingOwner function
            try {
                // Get ABI for Ownable2Step to check for pendingOwner
                const ownable2StepArtifact = await hre.artifacts.readArtifact(
                    '@openzeppelin/contracts/access/Ownable2Step.sol:Ownable2Step',
                );
                const ownable2StepContract = hre.tronweb.contract(
                    ownable2StepArtifact.abi,
                    contract.addr,
                );

                // Try to call pendingOwner() - if it exists, this is an Ownable2Step contract
                await ownable2StepContract.pendingOwner().call();
                // If we get here, the contract has pendingOwner function (Ownable2Step)
                contractsRequiringAcceptance.push(`${contract.name} (${contract.addr})`);
            } catch (error) {
                // Contract doesn't have pendingOwner function (regular Ownable)
                // This is expected for contracts that don't use Ownable2Step
            }
        } else {
            throw Error(
                `\tContract ${contract.name} ${contract.addr} has ${currentOwner} owner. It's impossible to change the owner.`,
            );
        }
    }

    // Display warning for contracts requiring ownership acceptance
    if (contractsRequiringAcceptance.length > 0) {
        console.log(
            '\n⚠️  WARNING: The following contracts use 2-step ownership and require the new owner to accept ownership:',
        );
        contractsRequiringAcceptance.forEach(contract => {
            console.log(`\t- ${contract}`);
        });
        console.log(
            `\n📝 The new owner (${newOwner}) must call acceptOwnership() on these contracts to complete the ownership transfer.`,
        );
        console.log(
            '💡 Until acceptOwnership() is called, the current owner retains control of these contracts.\n',
        );
    }
}
