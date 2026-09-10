/**
 * Types for `@pkmn/img/adaptable`. The package ships them, but its `exports`
 * map hides them from the bundler resolution TypeScript uses here, so the two
 * members `ui/slots.ts` needs are declared: the data-taking `Icons` class and
 * the item icon it returns.
 */
declare module '@pkmn/img/adaptable' {
  export interface AdaptableData {
    getItem(name: string): { spritenum?: number } | undefined;
    getPokemon(name: string): { id: string; spriteid: string; gen: number; num: number } | undefined;
    getAvatar(name: string): string | undefined;
  }
  export interface ItemIcon {
    style: string;
    url: string;
    top: number;
    left: number;
    css: Record<string, string>;
  }
  export class Icons {
    constructor(data: AdaptableData);
    getItem(name: string): ItemIcon;
  }
  export interface PokemonSprite {
    gen: number;
    w: number;
    h: number;
    url: string;
    pixelated: boolean;
  }
  export class Sprites {
    constructor(data: AdaptableData);
    getPokemon(name: string, options?: { gen?: string; side?: 'p1' | 'p2'; gender?: string; shiny?: boolean }): PokemonSprite;
  }
}
