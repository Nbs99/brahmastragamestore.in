
export interface GameEdition {
  name: string; // e.g., "Standard Edition", "Digital Deluxe"
  price: number;
  image?: string; // Optional specific cover for the edition
  perks: string[]; // List of extra stuff (e.g., "10 Unique Suits", "2 Skill Points")
}

export interface Game {
  id: string;
  title: string;
  price: number; // Base price
  originalPrice: number;
  discount: number;
  rating: number;
  image: string;
  video: string; // YouTube Embed URL
  platform: 'Steam' | 'Epic' | 'Ubisoft' | 'BattleNet' | 'PS5' | 'Xbox';
  genre: string;
  releaseDate: string;
  description: string;
  players: string;
  systemReq: {
    os: string;
    processor: string;
    memory: string;
    graphics: string;
    storage: string;
  };
  reviews: {
    user: string;
    rating: number;
    comment: string;
  }[];
  isNew?: boolean;
  editions?: GameEdition[]; // New Field
}

export interface UpcomingGame {
  id: string;
  title: string;
  releaseDate: string;
  image: string;
}

export interface CartItem extends Game {
  quantity: number;
  selectedEdition: string; // "Standard", "Deluxe"
  selectedEditionPrice: number;
  isBundle?: boolean; // New: Identify if item is a bundle
}

export interface Coupon {
  code: string;
  discountType: 'flat' | 'percent';
  value: number;
  minOrder?: number;
}

export interface RechargeCode {
  code: string;
  value: number;
  isUsed: boolean;
}

export interface UserProfile {
  name: string;
  avatar: string;
  ordersCount: number;
  wishlistCount: number;
  totalSpent: number;
  xp: number;
  walletBalance: number; // New: Wallet System
  rank: 'Noob' | 'Pro' | 'God Tier'; // Updated Ranks
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'Completed' | 'Processing';
}

export interface Story {
  id: string;
  title: string; // e.g., "Flash Sale"
  thumbnail: string; // Circular image
  image: string; // Full screen image
  type: 'image' | 'video';
  viewed: boolean;
}

export type SortOption = 'featured' | 'price_low' | 'price_high' | 'rating';
export type PlatformFilter = 'All' | 'Best Selling' | 'Offers' | 'Steam' | 'Epic' | 'Ubisoft' | 'BattleNet' | 'PS5' | 'Xbox';
