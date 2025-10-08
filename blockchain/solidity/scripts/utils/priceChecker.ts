import { ZeroAddress } from '../../configs';

/** 0.5 % */
export const DEFAULT_PRICE_DEVIATION_BPS = 50;

export function zeroPriceFeed(token: string) {
    return {
        asset: token,
        priceFeed: ZeroAddress,
        priceDeviationBps: 0,
        stalenessThreshold: 0,
    };
}
