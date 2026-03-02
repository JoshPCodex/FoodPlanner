import type { ComponentType } from 'react';
import { Apple } from './Apple';
import { BaconPack } from './BaconPack';
import { Banana } from './Banana';
import { BreadLoaf } from './BreadLoaf';
import { Carrot } from './Carrot';
import { ChickenDrumstick } from './ChickenDrumstick';
import { CheeseBlock } from './CheeseBlock';
import { Egg } from './Egg';
import { FishFillet } from './FishFillet';
import { GenericBox } from './GenericBox';
import { Lettuce } from './Lettuce';
import { MilkCarton } from './MilkCarton';
import { Onion } from './Onion';
import { Orange } from './Orange';
import { PastaBox } from './PastaBox';
import { SauceJar } from './SauceJar';
import { SeasoningJar } from './SeasoningJar';
import { SnackBag } from './SnackBag';
import { SteakPack } from './SteakPack';
import type { AssetProps } from './shared';

export type AssetId =
  | 'apple'
  | 'banana'
  | 'orange'
  | 'onion'
  | 'carrot'
  | 'lettuce'
  | 'milk'
  | 'cheese'
  | 'egg'
  | 'chicken'
  | 'steak'
  | 'bacon'
  | 'fish'
  | 'pasta'
  | 'sauce'
  | 'seasoning'
  | 'snack'
  | 'bread'
  | 'generic';

export const ASSET_COMPONENTS: Record<AssetId, ComponentType<AssetProps>> = {
  apple: Apple,
  banana: Banana,
  orange: Orange,
  onion: Onion,
  carrot: Carrot,
  lettuce: Lettuce,
  milk: MilkCarton,
  cheese: CheeseBlock,
  egg: Egg,
  chicken: ChickenDrumstick,
  steak: SteakPack,
  bacon: BaconPack,
  fish: FishFillet,
  pasta: PastaBox,
  sauce: SauceJar,
  seasoning: SeasoningJar,
  snack: SnackBag,
  bread: BreadLoaf,
  generic: GenericBox
};

export type { AssetProps } from './shared';
