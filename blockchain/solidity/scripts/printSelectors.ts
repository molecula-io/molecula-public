import { keccak256, type NamedFragment } from 'ethers';
import fs from 'fs';
import path from 'path';

function searchFile(dir: string): string[] {
    // Read the contents of the directory
    const files = fs.readdirSync(dir);
    const answer: string[] = [];

    // Search through the files
    files.forEach(file => {
        // Build the full path of the file
        const filePath = path.join(dir, file);

        // Get the file stats
        const fileStat = fs.statSync(filePath);

        // If the file is a directory, recursively search the directory
        if (fileStat.isDirectory()) {
            answer.push(...searchFile(filePath));
        } else if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
            answer.push(filePath);
        }
    });

    return answer;
}

function printSelectors() {
    const abiPaths: string[] = [];
    abiPaths.push(...searchFile('./artifacts/contracts/common'));
    abiPaths.push(...searchFile('./artifacts/contracts/core'));
    abiPaths.push(...searchFile('./artifacts/contracts/solutions'));

    // Create a function to parse ABI and encode its functions, errors, etc
    const getIds = (abiJs: NamedFragment[], type: string) => {
        // Create a function to concatenate function name with its param types
        const prepareData = (e: NamedFragment) => `${e.name}(${e.inputs.map(param => param.type)})`;

        // Create a function to encode a selector
        const encodeSelector = (text: string) => {
            const bytesText = new TextEncoder().encode(text);
            return keccak256(bytesText).slice(0, 10);
        };

        return abiJs
            .filter((e: NamedFragment) => e.type === type)
            .flatMap((e: NamedFragment) => `${encodeSelector(prepareData(e))}: ${prepareData(e)}`);
    };

    abiPaths.forEach(file => {
        const abiStr = fs.readFileSync(file, { encoding: 'utf-8' });
        const abiJs = JSON.parse(abiStr).abi;
        if (abiJs === undefined) {
            // It's not abi file
            return;
        }

        console.log(path.resolve(file));
        console.log('Functions:', getIds(abiJs, 'function'));
        console.log('Errors:', getIds(abiJs, 'error'));
        console.log('Events:', getIds(abiJs, 'event'));
    });
}

printSelectors();
