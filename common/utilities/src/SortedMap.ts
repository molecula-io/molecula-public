import { findIndexToInsert } from './functions';

export class SortedMap<T> {
    private map: Map<number, T>;

    private keys: number[];

    public constructor() {
        this.map = new Map();
        this.keys = []; // Maintain sorted keys
    }

    public source(): Map<number, T> {
        return this.map;
    }

    public keysList(): number[] {
        return this.keys;
    }

    public set(key: number, value: T) {
        if (!this.map.has(key)) {
            // Insert key in sorted position
            const insertIndex = findIndexToInsert(
                this.keys,
                key,
                (a, b) => a - b, // sort the values in the ascending order
            );
            this.keys.splice(insertIndex !== -1 ? insertIndex : this.keys.length, 0, key);
        }
        this.map.set(key, value);
    }

    public get(key: number): T | undefined {
        return this.map.get(key);
    }

    public delete(key: number) {
        this.map.delete(key);
        const index = this.keys.indexOf(key);
        if (index > -1) {
            this.keys.splice(index, 1);
        }
    }
}
