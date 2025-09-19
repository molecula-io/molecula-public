import type { BaseCollectionItem } from '../types';

export const replaceItemWithNewOne = <Item extends BaseCollectionItem>(
    item: Item,
    items: Item[],
) => {
    return items.map(el => {
        if (el.key === item.key) {
            return item;
        }
        return el;
    });
};
