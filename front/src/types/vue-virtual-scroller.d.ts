declare module 'vue-virtual-scroller' {
  import { DefineComponent } from 'vue';

  export const RecycleScroller: DefineComponent<{
    items: any[];
    itemSize: number | ((item: any) => number);
    minItemSize?: number;
    direction?: 'vertical' | 'horizontal';
    keyField?: string;
    listTag?: string;
    itemTag?: string;
    listClass?: string;
    itemClass?: string;
    gridItems?: number;
    buffer?: number;
    pageMode?: boolean;
    prerender?: number;
    typeField?: string;
    emitUpdate?: boolean;
    updateInterval?: number;
  }>;

  export const DynamicScroller: DefineComponent<{
    items: any[];
    minItemSize: number;
    keyField?: string;
    buffer?: number;
    pageMode?: boolean;
    prerender?: number;
    listTag?: string;
    itemTag?: string;
    listClass?: string;
    itemClass?: string;
  }>;

  export const DynamicScrollerItem: DefineComponent<{
    item: any;
    watchData?: boolean;
    active?: boolean;
    index?: number;
    sizeDependencies?: Array<string>;
    emitResize?: boolean;
    tag?: string;
  }>;
}
