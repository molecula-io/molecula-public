import { hashMessage, recoverAddress } from 'ethers';

import { SiweMessage } from 'siwe';

import { Log } from '@molecula-monorepo/common.logs';

const log = new Log('Evm verify signature');

/**
 * Build EIP4361 message options
 */
export interface BuildOptions {
    /**
     * Address for auth
     */
    address: string;
    /**
     * Nonce for auth
     */
    nonce: string;
    /**
     * Client host, ie molecula.io
     */
    host: string;
    /**
     * Client protocol, ie https
     */
    protocol: string;
    /**
     * Statement message for auth
     */
    statement: string;
}

/**
 * Build EIP4361 message
 * @param options - Build options
 */
export function buildEIP4361SignMessage(options: BuildOptions): string {
    const { address, nonce, host, protocol, statement } = options;

    const siweMessage = new SiweMessage({
        scheme: protocol,
        domain: host,
        uri: `${protocol}://${host}`,
        statement,
        version: '1',
        chainId: 1,
        address,
        nonce,
    });

    return siweMessage.prepareMessage();
}

/**
 * Validate EIP4361 sign message
 */
export function validEIP4361SignMessage(message: string): boolean {
    const siweMessage = new SiweMessage(message);
    return !!siweMessage;
}

/**
 * Verify EIP4361 signature options
 */
export interface VerifyOptions {
    /**
     * Address for verify signature
     */
    address: string;
    /**
     * Signature string for verify
     */
    signature: string;
    /**
     * The text of the message that was used to create the signature
     */
    message: string;
}

/**
 * Verify signature with message.
 * @param options - Verify options
 */
export function verifyEIP4361Signature(options: VerifyOptions): void {
    const { message, address, signature } = options;

    const messageHash = hashMessage(message);

    let recoveredAddress: string;
    try {
        recoveredAddress = recoverAddress(messageHash, signature);
    } catch (error) {
        log.debug('Failed to recover address with error:', error);

        throw new Error(`Signature invalid`);
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Signature mismatch');
    }
}
