# metaETH Protocol Contracts

## Overview

metaETH is a protocol for staking eth, wETH, stETH, etc. on Ethereum and receiving rewards.

## Installation

See [Quick Start](README.md#quick-start) and [Installation](README.md#installation).

## Deployment

To deploy the metaETH protocol, use the following command:

```bash
yarn metaEth:deploy:test
```

> **Note:** For production deployment, configure your environment variables in `.env.production`

## Verification

To verify the contracts, use the following command:

```bash
yarn metaEth:verify:sepolia
```

## Verification of protocol configuration

To verify the protocol configuration, use the following command:

```bash
# Verify metaEth protocol configuration across all environments
yarn metaEth:verify:configuration:test        # Test environment (Sepolia)
yarn metaEth:verify:configuration:beta        # Beta environment (Mainnet Ethereum)
yarn metaEth:verify:configuration:production  # Production environment (Mainnet Ethereum)
```
