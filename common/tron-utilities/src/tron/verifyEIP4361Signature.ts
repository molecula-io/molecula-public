import { TronWeb } from 'tronweb';

import { Log } from '@molecula-monorepo/common.logs';

const signTemplate = `$url wants you to sign in with your Tron account:
    $account

    $statement

    URI: $url
    Version: 1
    Chain ID: Tron
    Nonce: $nonce
    Issued At: $date`;

const validateReg =
    /^http[^\s]+ wants you to sign in with your Tron account:\n\s+T.+\n\n\s+Authorization in Atoms service/;

const log = new Log('Tron verify signature');

/**
 * Build EIP4361 message options
 */
export interface BuildOptions {
    /**
     * Address for auth
     */
    address: string;
    /**
     * nonce for auth
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
    const url = `${protocol}://${host}`;

    return signTemplate
        .replace(/\$url/g, url)
        .replace('$account', address)
        .replace('$statement', statement)
        .replace('$nonce', nonce)
        .replace('$date', new Date().toISOString());
}

/**
 * Validate EIP4361 sign message
 */
export function validEIP4361SignMessage(message: string): boolean {
    return validateReg.test(message);
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
    /**
     * Url to tron api
     */
    fullNode: string;
}

/**
 * Verify signature with message.
 * @param options - Verify options
 */
export async function verifyEIP4361Signature(options: VerifyOptions): Promise<void> {
    const { message, address, signature, fullNode } = options;

    const tronWeb = new TronWeb({
        fullHost: fullNode,
    });

    let recoveredAddress: string;

    try {
        recoveredAddress = await tronWeb.trx.verifyMessageV2(message, signature);
    } catch (error) {
        log.debug('Failed to verify the signature with error:', error);

        throw new Error(`Signature invalid`);
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Signature mismatch');
    }
}
