/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { deployNitrogenWithTokenVault } from '../../utils/NitrogenCommon';

describe('RebaseTokenOwner', () => {
    it('Test RebaseTokenOwner errors', async () => {
        const { rebaseTokenOwner, user0 } = await loadFixture(deployNitrogenWithTokenVault);

        // Test pause/pause mint
        await rebaseTokenOwner.pauseMint();
        expect(await rebaseTokenOwner.isMintPaused()).to.be.equal(true);
        await expect(rebaseTokenOwner.connect(user0).mint(user0, 1)).to.be.rejectedWith(
            'EFunctionPaused',
        );
        await rebaseTokenOwner.unpauseMint();
        expect(await rebaseTokenOwner.isMintPaused()).to.be.equal(false);
        await expect(rebaseTokenOwner.connect(user0).mint(user0, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );

        // Test pause/pause burn
        await rebaseTokenOwner.pauseBurn();
        expect(await rebaseTokenOwner.isBurnPaused()).to.be.equal(true);
        await expect(rebaseTokenOwner.connect(user0).burn(user0, 1)).to.be.rejectedWith(
            'EFunctionPaused',
        );
        await rebaseTokenOwner.unpauseBurn();
        expect(await rebaseTokenOwner.isBurnPaused()).to.be.equal(false);
        await expect(rebaseTokenOwner.connect(user0).burn(user0, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );

        // Test pause/pause all
        await rebaseTokenOwner.pauseAll();
        await expect(rebaseTokenOwner.connect(user0).mint(user0, 1)).to.be.rejectedWith(
            'EFunctionPaused',
        );
        await expect(rebaseTokenOwner.connect(user0).burn(user0, 1)).to.be.rejectedWith(
            'EFunctionPaused',
        );
        await rebaseTokenOwner.unpauseAll();
        await expect(rebaseTokenOwner.connect(user0).mint(user0, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );
        await expect(rebaseTokenOwner.connect(user0).burn(user0, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );

        // Test distribute errors
        await expect(rebaseTokenOwner.connect(user0).distribute([], [])).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );
    });

    it('Test PausableContract errors', async () => {
        const { rebaseTokenOwner } = await loadFixture(deployNitrogenWithTokenVault);
        await rebaseTokenOwner.pauseMint();
        await expect(rebaseTokenOwner.pauseMint()).to.be.rejectedWith('EAlreadySet');
        await rebaseTokenOwner.pauseAll();
        await expect(rebaseTokenOwner.pauseAll()).to.be.rejectedWith('EAllAlreadySet(true)');
    });
});
