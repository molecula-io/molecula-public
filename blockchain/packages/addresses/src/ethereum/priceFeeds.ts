import { EVMChainIDs } from './chains';

/**
 * Price feeds. See https://docs.chain.link/data-feeds/price-feeds/addresses
 */
export const chainLinkFeeds = {
    usd: {
        usdc: {
            [EVMChainIDs.Mainnet]: {
                address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
                heartbeat: 82800,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
                heartbeat: 86400,
            },
        },
        USDe: {
            [EVMChainIDs.Mainnet]: {
                address: '0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961',
                heartbeat: 82800,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x55ec7c3ed0d7CB5DF4d3d8bfEd2ecaf28b4638fb',
                heartbeat: 86400,
            },
        },
        sUSDe: {
            [EVMChainIDs.Mainnet]: {
                address: '0xFF3BC18cCBd5999CE63E788A1c250a88626aD099',
                heartbeat: 86400,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x6f7be09227d98Ce1Df812d5Bc745c0c775507E92',
                heartbeat: 86400,
            },
        },
    },
    eth: {
        stETH: {
            [EVMChainIDs.Mainnet]: {
                address: '0x86392dC19c0b719886221c78AB11eb8Cf5c52812',
                heartbeat: 86400,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x8328e01902A47942Eecb9DBF97d6bF9dd3bd07E6',
                heartbeat: 86400,
            },
        },
        weETH: {
            [EVMChainIDs.Mainnet]: {
                address: '0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22',
                heartbeat: 86400,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x0000000000000000000000000000000000000000',
                heartbeat: 0,
            },
        },
        rsETH: {
            [EVMChainIDs.Mainnet]: {
                address: '0x9d2F2f96B24C444ee32E57c04F7d944bcb8c8549',
                heartbeat: 86400,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x0000000000000000000000000000000000000000',
                heartbeat: 0,
            },
        },
        ezETH: {
            [EVMChainIDs.Mainnet]: {
                address: '0x636A000262F6aA9e1F094ABF0aD8f645C44f641C',
                heartbeat: 86400,
            },
            [EVMChainIDs.Sepolia]: {
                address: '0x0000000000000000000000000000000000000000',
                heartbeat: 0,
            },
        },
    },
} as const;
