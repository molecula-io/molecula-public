export const GAS_LIMIT_BASE = 0x100;
export const GAS_LIMIT_UNIT = 0x200;

export function formatGasLimitMsgType(msgType: number, base: number) {
    // eslint-disable-next-line no-bitwise
    const resultNumber = base | msgType;

    return `0x${resultNumber.toString(16).padStart(4, '0')}`;
}
