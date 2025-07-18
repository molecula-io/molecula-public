/* eslint-disable import/no-extraneous-dependencies */
import { parseCircular, parseDependencyTree, prettyCircular } from 'dpdm';
import fs from 'fs';

const checkCircularDependencies = async () => {
    console.log('Testing for circular dependencies using "DPDM"...');
    const sources = [
        './blockchain/packages/addresses/src/index.ts',
        './common/evm-utilities/src/index.ts',
        './common/tron-utilities/src/index.ts',
        './common/evm-contracts/src/index.ts',
        './common/logs/src/index.ts',
        './common/tron-contracts/src/index.ts',
        './common/shared/src/index.ts',
        './common/utilities/src/index.ts',
        './configs/eslint/index.json',
        './configs/tailwind/index.ts',
    ];
    for (let i = 0; i < sources.length; i += 1) {
        const f = sources[i]!;
        const fileExists = fs.existsSync(f);
        if (!fileExists) {
            throw new Error(`${f} is not exist`);
        }
    }
    const extensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.native.ts',
        '.native.tsx',
        '.native.js',
        '.native.jsx',
        '.web.ts',
        '.web.tsx',
        '.web.js',
        '.web.jsx',
        '.ios.ts',
        '.ios.tsx',
        '.ios.js',
        '.ios.jsx',
        '.android.ts',
        '.android.tsx',
        '.android.js',
        '.android.jsx',
        '.mjs',
        '.json',
    ];

    const tree = await parseDependencyTree(sources, { extensions });
    const circulars = parseCircular(tree);

    if (circulars.length > 0) {
        console.log(
            '\x1b[33m%s\x1b[0m', // yellow
            `Circular dependencies were found by "DPDM" (${circulars.length}):\n`,
            prettyCircular(circulars),
        );
        process.exit(1);
    } else {
        console.info(
            '\x1b[32m%s\x1b[0m', // green
            'Congratulations! "DPDM" haven\'t found any circular dependencies in your code!',
        );
    }
};

checkCircularDependencies().catch(error => {
    console.error(
        '\x1b[31m%s\x1b[0m', // red
        'Failed to find circular dependencies with error:',
        error,
    );
    process.exit(1);
});
