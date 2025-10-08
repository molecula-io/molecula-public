# MrETH Protocol Contracts

## Overview

MrETH is a protocol for liquid restaking on Ethereum.

## Installation

See [Quick Start](README.md#quick-start) and [Installation](README.md#installation).

## Deployment

To deploy the MrETH protocol, use one of the following commands:

```bash
yarn mrEth:deploy:[test|beta|production|hoodi|holesky]
```

> **Note:** For production deployment, configure your environment variables in `.env.production`

## Verification

To verify the contracts, use the following command:

```bash
yarn mrEth:verify:[sepolia|hoodi|holesky]
```

## Verification

After deployment, verify contracts on block explorers using the verification scope:

```bash
# Verify mrETH contracts (legacy commands)
yarn mrEth:verify:sepolia
yarn mrEth:verify:holesky
yarn mrEth:verify:hoodi
```

## Verification of protocol configuration

To verify the protocol configuration, use the following command:

```bash
# Verify metaEth protocol configuration across all environments
yarn mrEth:verify:configuration:test        # Test environment (Sepolia)
yarn mrEth:verify:configuration:beta        # Beta environment (Mainnet Ethereum)
yarn mrEth:verify:configuration:production  # Production environment (Mainnet Ethereum)
```
