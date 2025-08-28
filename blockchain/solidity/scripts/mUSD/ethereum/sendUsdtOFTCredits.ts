import { ethers } from 'hardhat';

import { sepoliaConfig } from '../../../configs';

async function sendUSDTCreditsCrossChain() {
    const amountToSend = ethers.parseUnits('1000', 6); // 1000 USDT (6 decimals)

    // Contract instances
    const usdtToken = await ethers.getContractAt('UsdtEthereum', sepoliaConfig.USDT_ADDRESS);
    const usdtOFT = await ethers.getContractAt('UsdtOFT', sepoliaConfig.USDT_OFT);

    // Step 1: Approve USDT tokens
    console.log(`Approving ${amountToSend} USDT for UsdtOFT...`);
    const approveTx = await usdtToken.approve(sepoliaConfig.USDT_OFT, amountToSend);
    await approveTx.wait(2);
    console.log('Approval successful:', approveTx.hash);

    // Step 2: Deposit Local Liquidity
    console.log(`Depositing ${amountToSend} USDT to UsdtOFT...`);
    const depositTx = await usdtOFT.depositLocal(amountToSend);
    await depositTx.wait(2);
    console.log('Deposit successful:', depositTx.hash);

    // Step 3: Quote LayerZero Fee (quoteSendCredits)
    console.log('Quoting LayerZero messaging fee...');

    const feeQuote = await usdtOFT.quoteSendCredits(
        sepoliaConfig.LAYER_ZERO_TRON_EID, // dstEid
        0n, // Arbitrum credits
        0n, // Celo credits
        amountToSend, // Ethereum credits
        0n, // Ton credits
        0n, // Tron credits
        '0x', // extraOptions
        false, // payInLzToken (native token TRX)
    );
    const nativeFee = feeQuote[0];
    console.log(`Fee required: ${ethers.formatEther(nativeFee)} ETH`);

    // Step 4: Execute cross-chain credit transfer (sendCredits)
    console.log('Sending cross-chain credits...');
    const sendCreditsTx = await usdtOFT.sendCredits(
        sepoliaConfig.LAYER_ZERO_TRON_EID, // Tron destination EID
        0n, // Arbitrum credits
        0n, // Celo credits
        amountToSend, // Ethereum credits
        0, // Ton credits
        0, // Tron credits
        '0x', // extraOptions
        feeQuote, // MessagingFee struct
        { value: nativeFee }, // ETH required for LayerZero fees
    );

    await sendCreditsTx.wait();
    console.log('Cross-chain transfer successful:', sendCreditsTx.hash);
}

sendUSDTCreditsCrossChain()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
