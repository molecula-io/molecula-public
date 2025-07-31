import { tronweb } from 'hardhat';

import { abi as usdtOFT } from '../../artifacts/contracts/solutions/Carbon/common/UsdtOFT.sol/UsdtOFT.json';
import { abi as usdtContract } from '../../artifacts/contracts/test/UsdtTron.sol/UsdtTron.json';
import { sepoliaConfig } from '../../configs/ethereum';
import { shastaConfig } from '../../configs/tron/shastaTyped';

async function sendUSDTCreditsCrossChain() {
    const amountToSend = 1000e6; // Sending 1000 USDT cross-chain

    const usdtOFTContract = tronweb.contract(usdtOFT, shastaConfig.USDT_OFT);
    const usdtTokenContract = tronweb.contract(usdtContract, shastaConfig.USDT_ADDRESS);

    const quoteParams = [
        sepoliaConfig.LAYER_ZERO_ETHEREUM_EID.toString(), // dstEid
        '0', // Arbitrum credits
        '0', // Celo credits
        '0', // Ethereum credits
        '0', // Ton credits
        amountToSend.toString(), // Tron credits
        '0x', // extraOptions
        false, // payInLzToken (native token TRX)
    ];

    // Step 1: Approve USDT tokens first (assuming standard USDT token on Tron)
    console.log(`Approving ${amountToSend} USDT for UsdtOFT...`);

    if (!('approve' in usdtTokenContract.methods)) {
        throw new Error('Approve method not supported');
    }

    const approveTx = await usdtTokenContract.methods
        .approve(shastaConfig.USDT_OFT, amountToSend)
        .send({
            feeLimit: +tronweb.toSun(100),
        });
    console.log('Approval successful.');
    console.log('Transaction Hash:', approveTx);

    // Step 2: Depositing local liquidity
    // @ts-ignore
    const depositTx = await usdtOFTContract.methods.depositLocal(amountToSend).send({
        feeLimit: +tronweb.toSun(100),
    });

    console.log('Deposit successful!');
    console.log('Transaction Hash:', depositTx);

    // // Step 2: Quote LayerZero Messaging Fee
    console.log('Quoting LayerZero messaging fee...');

    if (!('quoteSendCredits' in usdtOFTContract.methods)) {
        throw new Error('QuoteSendCredits method not supported');
    }

    const feeQuote = await usdtOFTContract.methods
        .quoteSendCredits(...quoteParams)
        .call({ _isConstant: true });

    console.log('txresponse:', feeQuote);
    const nativeFee = feeQuote[0].nativeFee.toString();
    console.log(`Fee required: ${tronweb.fromSun(nativeFee)} TRX`);

    // Step 3: Execute Cross-chain Transfer
    console.log('Sending cross-chain USDT...');

    if (!('sendCredits' in usdtOFTContract.methods)) {
        throw new Error('SendCredits method not supported');
    }

    const sendCreditTxId = await usdtOFTContract.methods
        // @ts-ignore
        .sendCredits(
            sepoliaConfig.LAYER_ZERO_ETHEREUM_EID.toString(), // dstEid
            '0', // Arbitrum credits
            '0', // Celo credits
            '0', // Ethereum credits
            '0', // Ton credits
            amountToSend.toString(), // Tron credits
            '0x', // extraOptions
            ...feeQuote,
        )
        .send({
            feeLimit: +tronweb.toSun(100), // adjust as necessary
            callValue: nativeFee, // LayerZero messaging fee in TRX
        });

    console.log('Transaction successful!');
    console.log('Tx Hash:', sendCreditTxId);
}

sendUSDTCreditsCrossChain()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
