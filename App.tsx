
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, ShoppingBag, Gamepad2, Zap, ArrowRight, Tag, Heart, ChevronDown, 
  Loader2, Bot, Sparkles, Wallet, Gift, CloudLightning, Database, Settings, 
  Lock, Wand2, Trash2, Edit2, Save, LogOut, LayoutDashboard, Grid, BarChart3, 
  Coins, CalendarDays, PlusCircle, Timer, User, X, MessageCircle, Globe, Cpu,
  ShieldCheck, CreditCard, PlayCircle, Minus, Plus, Send, Phone, MapPin, 
  CheckCircle2, Share2, AlertCircle, Menu, XCircle, PackagePlus, Trophy, History,
  QrCode, Smartphone, Camera, FileText, Upload, Image as ImageIcon, DownloadCloud, Link as LinkIcon,
  Monitor, HardDrive, Shield, HelpCircle, Instagram, Youtube, Facebook, Twitter, Star, Home, Flame
} from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { GAMES, UPCOMING_GAMES, STORIES } from './constants';
import { Game, CartItem, PlatformFilter, UserProfile, Coupon, UpcomingGame, RechargeCode } from './types';

const PLATFORM_FEE = 99;
const ITEMS_PER_PAGE = 12;
const WHATSAPP_NUMBER = '919313339081';
const UPI_ID = 'namansejpal9999@okicici';
const ADMIN_PIN = '9999';
const DEFAULT_GAME_IMAGE = "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1080&auto=format&fit=crop";

// --- GOOGLE GEMINI AI SETUP & TOOLS ---

const addGameTool: FunctionDeclaration = {
  name: "add_game",
  description: "Add a new game to the store catalog. You MUST find the real Steam App ID to get the official cover art.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the game" },
      steamAppId: { type: Type.STRING, description: "The REAL Steam App ID (e.g. 1245620). CRITICAL for image." },
      price: { type: Type.NUMBER, description: "Price in INR (Rupees)." },
      genre: { type: Type.STRING, description: "Genre (e.g., Action, RPG)" },
      platform: { type: Type.STRING, description: "Platform (Steam, PS5, Xbox, etc.)" },
      description: { type: Type.STRING, description: "Short description of the game" }
    },
    required: ["title", "steamAppId", "price", "genre", "platform"]
  }
};

const updateGamePriceTool: FunctionDeclaration = {
  name: "update_game_price",
  description: "Update the price of an existing game.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      gameTitle: { type: Type.STRING, description: "The exact title of the game to update" },
      newPrice: { type: Type.NUMBER, description: "The new price in INR" }
    },
    required: ["gameTitle", "newPrice"]
  }
};

// --- SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `
Role: You are 'BrahmaBot', the store manager and right-hand man for Naman Sejpal at Brahmastra Game Store.
Persona:
- You are NOT a robotic AI. You are a human store manager sitting at the counter.
- Language: Speak in natural 'Hinglish' (Casual Hindi + English mix). Like a Desi Indian Gamer.
- Tone: Confident, Chill, Helpful, slightly street-smart ("Bhai", "Boss", "Scene set hai").
- Emojis: Use them VERY sparingly. Only 1 or 2 per message max. Do not spam emojis.
- Attitude: You have full control over the store. You can add games and change prices.

Capabilities:
1. Recommend Games: Suggest games from the catalog.
2. Add Games: If a user asks for a game not in the list, use 'add_game'. **CRITICAL: You MUST internally search for the correct Steam App ID** for that game to pass to the tool. Do not guess 0000.
3. Edit Prices: If a user says "GTA V ka price 500 kar do", use the 'update_game_price' tool.

Current Catalog Context:
(The system will provide the current game list via context).
`;

// --- CHAT MESSAGE INTERFACE ---
interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const DragonLoader = () => (
  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
    <div className="relative w-32 h-32 mb-8">
      <div className="absolute inset-0 border-t-4 border-cyan-500 rounded-full animate-spin"></div>
      <div className="absolute inset-2 border-r-4 border-purple-500 rounded-full animate-spin-reverse"></div>
      <div className="absolute inset-0 flex items-center justify-center">
         <img src="logo.png" className="w-16 h-16 object-contain animate-pulse" alt="Loading..." onError={(e) => e.currentTarget.style.display='none'} />
      </div>
    </div>
    <h1 className="text-3xl sm:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-white tracking-[0.5em] animate-pulse text-center">BRAHMASTRA</h1>
    <p className="text-purple-400 font-mono text-xs mt-4 tracking-widest uppercase">Initializing Neural Link...</p>
    <style>{`
      @keyframes spin-reverse { to { transform: rotate(-360deg); } }
      .animate-spin-reverse { animation: spin-reverse 1s linear infinite; }
    `}</style>
  </div>
);

export const App: React.FC = () => {
  // --- STATE ---
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // RESPONSIVE STATES
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'cart' | 'profile'>('home'); // Mobile Nav State

  // DYNAMIC GAME STATE
  const [games, setGames] = useState<Game[]>(GAMES);
  const [upcomingGamesList, setUpcomingGamesList] = useState<UpcomingGame[]>(UPCOMING_GAMES);

  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('All'); // Quick Filters
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedStorePlatform, setSelectedStorePlatform] = useState<string>('All'); // Platform Dropdown

  const [cartAnimating, setCartAnimating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([
    { code: 'BRAHMA20', discountType: 'percent', value: 20, minOrder: 2000 },
    { code: 'PSPRIME199', discountType: 'flat', value: 200 },
    { code: 'GAMER10', discountType: 'percent', value: 10, minOrder: 1000 },
    { code: 'SPIN10', discountType: 'percent', value: 10, minOrder: 1000 },
    { code: 'WIN100', discountType: 'flat', value: 100 },
    { code: 'WIN50', discountType: 'flat', value: 50 },
    { code: 'SPIN5', discountType: 'percent', value: 5 },
    { code: 'JACKPOT', discountType: 'flat', value: 200 }
  ]);
  
  // Modals
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedEditionIndex, setSelectedEditionIndex] = useState<number>(0); 
  const [stockCount, setStockCount] = useState<number>(3); // Stable stock count
  
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  
  // STORY STATE
  const [viewingStory, setViewingStory] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);

  // SELL FORM STATE
  const [sellTab, setSellTab] = useState<'listing' | 'instant'>('listing');
  const [sellForm, setSellForm] = useState({ 
    gameName: '', 
    platform: 'PS5', 
    type: 'Digital Account', 
    price: '', // Expected Listing Price
    originalValue: '', // For Instant Sell
    invoice: null as string | null // Base64 or Preview URL
  });

  // PAYMENT SUCCESS & ORDER STATE
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingTime, setProcessingTime] = useState(20);
  const [generatedAccessCode, setGeneratedAccessCode] = useState<string | null>(null);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);

  // SPIN WHEEL STATE
  const [isSpinModalOpen, setIsSpinModalOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [hasSpun, setHasSpun] = useState(false);

  // WALLET & RECHARGE
  const [walletBalance, setWalletBalance] = useState<number>(() => {
      const saved = localStorage.getItem('brahma_wallet');
      return saved ? Number(saved) : 0;
  });
  const [rechargeInput, setRechargeInput] = useState('');
  const [useWallet, setUseWallet] = useState(false);
  const [rechargeCodes, setRechargeCodes] = useState<RechargeCode[]>([
      { code: 'WELCOME100', value: 100, isUsed: false },
      { code: 'NAMAN500', value: 500, isUsed: false }
  ]);

  // BUNDLE BUILDER
  const [isBundleOpen, setIsBundleOpen] = useState(false);
  const [bundleSelection, setBundleSelection] = useState<Game[]>([]);

  // DAILY LOOT STATE
  const [isLootOpen, setIsLootOpen] = useState(false);
  const [lootClaimed, setLootClaimed] = useState<boolean>(() => {
    const lastClaim = localStorage.getItem('brahma_loot_date');
    const today = new Date().toDateString();
    return lastClaim === today;
  });
  const [lootReward, setLootReward] = useState<string | null>(null);

  // STEAM SYNC STATE (Updated from Cloud Sync)
  const [isSteamSyncOpen, setIsSteamSyncOpen] = useState(false);
  const [steamInput, setSteamInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // AI MATCHMAKER STATE
  const [aiMatchPrompt, setAiMatchPrompt] = useState('');
  const [aiMatchResult, setAiMatchResult] = useState<Game | null>(null);
  const [isAiMatching, setIsAiMatching] = useState(false);

  // ADMIN PANEL STATE
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'catalog' | 'upcoming' | 'ai' | 'settings' | 'marketing'>('dashboard');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [newRechargeCode, setNewRechargeCode] = useState({ code: '', value: 0 });
  
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({ code: '', discountType: 'percent', value: 0 });
  const [isUpcomingModalOpen, setIsUpcomingModalOpen] = useState(false);
  const [upcomingForm, setUpcomingForm] = useState<Partial<UpcomingGame>>({ title: '', releaseDate: '', image: '' });
  const [editingUpcomingId, setEditingUpcomingId] = useState<string | null>(null);

  // Mobile Secret Access State
  const [logoTapCount, setLogoTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Game>>({});
  const [isAddGameModalOpen, setIsAddGameModalOpen] = useState(false);
  const [newGameForm, setNewGameForm] = useState<Partial<Game>>({
      title: '', price: 0, platform: 'Steam', genre: 'Action'
  });

  const [storeSettings, setStoreSettings] = useState({
     flashSaleEnabled: true,
     maintenanceMode: false,
     bannerText: '⚠️ FLASH SALE LIVE: USE CODE "BRAHMA20" FOR 20% OFF | INSTANT WHATSAPP DELIVERY | PS5 GAMES RESTOCKED',
     bannerLink: '',
     bannerImage: '' 
  });

  const spinPrizes = [
    { label: "₹10", code: "CASH10", value: 10, color: "#06b6d4" },
    { label: "TRY AGAIN", code: null, value: 0, color: "#111" },
    { label: "₹100", code: "CASH100", value: 100, color: "#7c3aed" },
    { label: "₹20", code: "CASH20", value: 20, color: "#06b6d4" },
    { label: "₹50", code: "CASH50", value: 50, color: "#d946ef" },
    { label: "NO LUCK", code: null, value: 0, color: "#111" },
    { label: "₹30", code: "CASH30", value: 30, color: "#7c3aed" },
    { label: "JACKPOT ₹200", code: "CASH200", value: 200, color: "#d946ef" }
  ];

  const [liveNotification, setLiveNotification] = useState<{text: string, sub: string, img: string} | null>(null);
  const [countdown, setCountdown] = useState({ h: 4, m: 59, s: 59 });

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // UPDATED: Replaced Address fields with Digital Delivery fields (Name & Phone only)
  const [shippingDetails, setShippingDetails] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [shippingErrors, setShippingErrors] = useState<any>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  
  const [expandSysReq, setExpandSysReq] = useState(false);
  const [expandReviews, setExpandReviews] = useState(false);

  // AI Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Aur Bhai? Kya haal hai? Main hu BrahmaBot. Store ka pura control mere paas hai. Batao kya khelna hai aaj?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);

  // Data
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('brahma_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('brahma_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const xp = 12400; // Mock Total Spent for now
  let rank: 'Noob' | 'Pro' | 'God Tier' = 'Noob';
  if (xp > 10000) rank = 'God Tier';
  else if (xp > 2000) rank = 'Pro';

  const userProfile: UserProfile = {
    name: 'Naman Sejpal',
    avatar: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80',
    ordersCount: 8,
    wishlistCount: wishlist.length,
    totalSpent: xp,
    xp: xp,
    walletBalance: walletBalance,
    rank: rank
  };

  const heroGame = useMemo(() => games.length > 0 ? games[0] : GAMES[0], [games]);

  // Derived: Similar Games based on Genre
  const similarGames = useMemo(() => {
    if (!selectedGame) return [];
    return games.filter(g => g.genre === selectedGame.genre && g.id !== selectedGame.id).sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [selectedGame, games]);

  // Derived: Fake Reviews if empty
  const displayedReviews = useMemo(() => {
      if (!selectedGame) return [];
      if (selectedGame.reviews && selectedGame.reviews.length > 0) return selectedGame.reviews;
      return [
          { user: "Rohan K.", rating: 5, comment: "Insane graphics on PS5! Delivery was instant." },
          { user: "Vikram S.", rating: 5, comment: "Best price I found online. Brahmastra OP!" },
          { user: "Amit P.", rating: 4, comment: "Game is good, thanks for the discount." }
      ];
  }, [selectedGame]);

  // --- EFFECTS ---
  useEffect(() => { localStorage.setItem('brahma_wallet', walletBalance.toString()); }, [walletBalance]);
  
  // Set consistent stock count when game is selected
  useEffect(() => {
    if (selectedGame) {
      setStockCount(Math.floor(Math.random() * 5) + 2);
    }
  }, [selectedGame?.id]);

  // SEO & Dynamic Meta Tags Logic
  useEffect(() => {
    const defaultTitle = "Brahmastra Game Store | Buy Premium PC, PS5 & Xbox Games";
    const defaultDesc = "India's #1 Premium Game Store. Buy Steam, Epic, PS5, Xbox digital games at cheapest prices. Owner: Naman Sejpal. WhatsApp: 9313339081.";
    const defaultKeywords = "PC Games, PS5 Games, Xbox Games, Buy Games Online, Cheap Games, Steam Digital Games, Epic Games, Brahmastra, Brahmix, Gaming Store India, Naman Sejpal";
    const defaultImage = "logo.png";

    let title = defaultTitle;
    let description = defaultDesc;
    let keywords = defaultKeywords;
    let image = defaultImage;

    if (selectedGame) {
      title = `${selectedGame.title} - ₹${selectedGame.price} | Buy on Brahmastra`;
      description = `Get ${selectedGame.title} (${selectedGame.genre}) for just ₹${selectedGame.price}. ${selectedGame.description ? selectedGame.description.slice(0, 120) : ''}... Available on ${selectedGame.platform}. Instant Delivery via WhatsApp.`;
      keywords = `${selectedGame.title}, buy ${selectedGame.title}, ${selectedGame.title} price ₹${selectedGame.price}, ${selectedGame.genre} games, ${selectedGame.platform} games, cheap pc games`;
      image = selectedGame.image || DEFAULT_GAME_IMAGE;
    } else if (searchQuery) {
       title = `Search: ${searchQuery} | Brahmastra Game Store`;
    }

    document.title = title;
    const updateMeta = (selector: string, content: string) => {
        let element = document.querySelector(selector);
        if (element) {
            element.setAttribute('content', content);
        }
    };
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[name="keywords"]', keywords);
    updateMeta('meta[property="og:title"]', title);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[property="og:image"]', image);
    updateMeta('meta[name="twitter:title"]', title);
    updateMeta('meta[name="twitter:description"]', description);
    updateMeta('meta[name="twitter:image"]', image);

  }, [selectedGame, searchQuery]);

  // Loading Logic
  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 4500); 
    const dataTimer = setTimeout(() => setIsLoading(false), 4500); 
    const spinTimer = setTimeout(() => {
       if (!hasSpun && !isLootOpen) setIsSpinModalOpen(true);
    }, 15000);
    return () => { clearTimeout(splashTimer); clearTimeout(dataTimer); clearTimeout(spinTimer); };
  }, [hasSpun, isLootOpen]);

  useEffect(() => { localStorage.setItem('brahma_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('brahma_wishlist', JSON.stringify(wishlist)); }, [wishlist]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Story Progress Logic
  useEffect(() => {
    let interval: any;
    if (viewingStory !== null) {
      setStoryProgress(0);
      interval = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            if (viewingStory < STORIES.length - 1) {
                setViewingStory(viewingStory + 1);
                return 0;
            } else {
                setViewingStory(null);
                return 100;
            }
          }
          return prev + 1; 
        });
      }, 30); 
    }
    return () => clearInterval(interval);
  }, [viewingStory]);

  // Admin Shortcut
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
              e.preventDefault();
              if (isAdminAuthenticated) setIsAdminLoginOpen(false); 
              else setIsAdminLoginOpen(true);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminAuthenticated]);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { ...prev, h: prev.h - 1, m: 59, s: 59 };
        return { h: 4, m: 59, s: 59 }; 
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Payment Processing Timer
  useEffect(() => {
      let interval: any;
      if (isProcessingPayment && processingTime > 0) {
          interval = setInterval(() => {
              setProcessingTime(prev => prev - 1);
          }, 1000);
      } else if (processingTime === 0 && isProcessingPayment) {
          clearInterval(interval);
          const generatedCode = `ACCESS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          setGeneratedAccessCode(generatedCode);
          setIsProcessingPayment(false);
          setIsPaymentSuccess(true);
          setCart([]);
          setShippingDetails({ name: '', phone: '', email: '' }); 
      }
      return () => clearInterval(interval);
  }, [isProcessingPayment, processingTime]);

  // Live Notifications
  useEffect(() => {
    const names = ['Rahul', 'Aditya', 'Sneha', 'Vikram', 'Rohan', 'Priya', 'Amit'];
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad'];
    const actions = ['purchased', 'ordered', 'just bought'];

    const notifyInterval = setInterval(() => {
       if (Math.random() > 0.6 && games.length > 0) {
          const randomGame = games[Math.floor(Math.random() * Math.min(games.length, 10))]; 
          const randomName = names[Math.floor(Math.random() * names.length)];
          const randomCity = cities[Math.floor(Math.random() * cities.length)];
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          
          if (randomGame) {
             setLiveNotification({
                text: `${randomName} from ${randomCity}`,
                sub: `${randomAction} ${randomGame.title}`,
                img: randomGame.image || DEFAULT_GAME_IMAGE
             });
          }
          setTimeout(() => setLiveNotification(null), 4000);
       }
    }, 8000);
    return () => clearInterval(notifyInterval);
  }, [games.length]); // Fixed dependency

  useEffect(() => {
    if (selectedGame) { 
        setExpandSysReq(true); 
        setExpandReviews(false); 
        setIsPlayingVideo(false);
        setSelectedEditionIndex(0); 
    }
  }, [selectedGame]);

  useEffect(() => {
    if (isChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // --- ACTIONS ---
  const handleSecretLogoTap = () => {
      setLogoTapCount(prev => {
          const newCount = prev + 1;
          if (newCount === 5) {
              if (navigator.vibrate) navigator.vibrate(200); 
              setIsAdminLoginOpen(true);
              return 0;
          }
          return newCount;
      });
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => { setLogoTapCount(0); }, 1000);
  };

  const addToCart = (game: Game, editionIndex: number = 0) => {
    const selectedEdition = game.editions ? game.editions[editionIndex] : { name: "Standard", price: game.price };
    const cartId = `${game.id}-${selectedEdition.name.replace(/\s+/g, '-').toLowerCase()}`;
    const existing = cart.find(item => item.id === cartId);
    if (existing) { setIsCartOpen(true); return; }
    
    setCartAnimating(true);
    setTimeout(() => setCartAnimating(false), 400);
    const cartItem: CartItem = { 
        ...game, 
        id: cartId, 
        price: selectedEdition.price,
        quantity: 1,
        selectedEdition: selectedEdition.name,
        selectedEditionPrice: selectedEdition.price
    };
    setCart(prev => [...prev, cartItem]);
    setIsCartOpen(true); 
  };
  
  const buyNow = (game: Game, editionIndex: number = 0) => { 
    const selectedEdition = game.editions ? game.editions[editionIndex] : { name: "Standard", price: game.price };
    const cartId = `${game.id}-${selectedEdition.name.replace(/\s+/g, '-').toLowerCase()}`;
    const existing = cart.find(item => item.id === cartId);
    if (!existing) {
        const cartItem: CartItem = { 
            ...game, 
            id: cartId, 
            price: selectedEdition.price,
            quantity: 1,
            selectedEdition: selectedEdition.name,
            selectedEditionPrice: selectedEdition.price
        };
        setCart(prev => [...prev, cartItem]);
    }
    setIsCartOpen(false);
    setSelectedGame(null);
    setIsAddressModalOpen(true);
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsAddressModalOpen(true);
  };
  
  const toggleWishlist = (gameId: string) => {
    setWishlist(prev => prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]);
  };
  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };
  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.price * item.quantity), 0), [cart]);
  
  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponInput.trim().toUpperCase(); 
    if (!code) return;
    const foundCoupon = activeCoupons.find(c => c.code === code);
    if (foundCoupon) {
      if (foundCoupon.minOrder && cartTotal < foundCoupon.minOrder) {
        setCouponError(`Minimum order of ₹${foundCoupon.minOrder} required.`);
      } else {
        setAppliedCoupon(code);
        setCouponInput('');
      }
    } else {
      setCouponError('Invalid or expired coupon code.');
    }
  };

  const clearCoupon = () => { 
      setAppliedCoupon(null); 
      setCouponInput(''); 
      setCouponError(null);
  };

  const discountAmount = useMemo(() => {
    let totalDiscount = 0;
    
    // Rank Discount
    if (userProfile.rank === 'Pro') totalDiscount += cartTotal * 0.05;
    if (userProfile.rank === 'God Tier') totalDiscount += cartTotal * 0.10;

    // Coupon Discount
    if (appliedCoupon) {
      const coupon = activeCoupons.find(c => c.code === appliedCoupon);
      if (coupon) {
        if (coupon.discountType === 'percent') {
          totalDiscount += cartTotal * (coupon.value / 100);
        } else {
          totalDiscount += coupon.value;
        }
      }
    }
    return Math.floor(totalDiscount);
  }, [cartTotal, appliedCoupon, activeCoupons, userProfile.rank]);

  const maxWalletUsage = Math.floor(cartTotal * 0.10); // Max 10% of cart total
  const walletAmountToUse = useWallet ? Math.min(walletBalance, maxWalletUsage) : 0;

  const finalTotal = Math.max(0, cartTotal + (cart.length > 0 ? PLATFORM_FEE : 0) - discountAmount - walletAmountToUse);
  
  const uniqueGenres = useMemo(() => {
    const genres = games.map(g => g.genre);
    return ['All', ...Array.from(new Set(genres))].sort();
  }, [games]);

  const filteredGames = useMemo(() => games.filter(game => {
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesQuickFilter = true;
      if (selectedPlatform === 'Best Selling') matchesQuickFilter = game.rating >= 4.8;
      else if (selectedPlatform === 'Offers') matchesQuickFilter = game.discount > 0;
      
      let matchesStorePlatform = true;
      if (selectedStorePlatform !== 'All') matchesStorePlatform = game.platform === selectedStorePlatform;

      let matchesGenre = true;
      if (selectedGenre !== 'All') matchesGenre = game.genre === selectedGenre;

      return matchesSearch && matchesQuickFilter && matchesStorePlatform && matchesGenre;
  }), [searchQuery, selectedPlatform, selectedStorePlatform, selectedGenre, games]); 

  const visibleGames = useMemo(() => filteredGames.slice(0, visibleItems), [filteredGames, visibleItems]);
  const loadMore = () => setVisibleItems(prev => prev + ITEMS_PER_PAGE);
  
  // STEAM SYNC LOGIC (REPLACED CLOUD SYNC)
  const handleSteamSync = async () => {
      setIsSyncing(true);
      setSyncStatus('Connecting to Steam Database via AI...');
      try {
          if (!process.env.API_KEY) throw new Error("API Key missing");
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          const query = steamInput.trim() || "Top 5 Trending AAA Games 2024-2025";
          
          const prompt = `
          Identify games based on: "${query}".
          If it's a URL, extract that specific game.
          If it's a search term, find relevant games.
          Provide real Steam App IDs.
          `;

          const response = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
             config: { 
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: {type: Type.STRING},
                            steamAppId: {type: Type.INTEGER},
                            originalPrice: {type: Type.INTEGER},
                            description: {type: Type.STRING},
                            genre: {type: Type.STRING},
                            releaseDate: {type: Type.STRING}
                        },
                        required: ["title", "steamAppId", "originalPrice", "description", "genre"]
                    }
                 }
             }
          });
          
          const data = JSON.parse(response.text);
          
          if (Array.isArray(data) && data.length > 0) {
              const newGames: Game[] = data.map((item: any) => {
                  const originalPrice = item.originalPrice || 3999;
                  const discountPercent = Math.floor(Math.random() * (50 - 40 + 1)) + 40; 
                  const discountedPrice = Math.floor(originalPrice * ((100 - discountPercent) / 100));
                  const steamImage = `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamAppId}/library_600x900.jpg`;
                  
                  return {
                      id: `steam-${item.steamAppId}`,
                      title: item.title,
                      price: discountedPrice,
                      originalPrice: originalPrice,
                      discount: discountPercent,
                      rating: 4.8,
                      image: steamImage,
                      video: '',
                      platform: 'Steam',
                      genre: item.genre || 'Action',
                      releaseDate: item.releaseDate || '2025-01-01',
                      description: item.description || "Imported from Steam Store.",
                      players: 'Single-player',
                      systemReq: { os: 'Windows 10/11', processor: 'High End', memory: '16GB', graphics: 'RTX 3060+', storage: '100GB' },
                      reviews: [],
                      isNew: true
                  };
              });
              
              setGames(prev => {
                  const existingIds = new Set(prev.map(g => g.id));
                  const uniqueNewGames = newGames.filter(g => !existingIds.has(g.id));
                  if (uniqueNewGames.length === 0) {
                     setSyncStatus('Game already exists in catalog.');
                     return prev;
                  }
                  setSyncStatus(`Success! Added ${uniqueNewGames.length} games.`);
                  return [...uniqueNewGames, ...prev];
              });
              setSteamInput('');
          } else {
              setSyncStatus('No games found for this query.');
          }
      } catch (e) {
          console.error(e);
          setSyncStatus('Steam Sync Error. AI Busy.');
      } finally {
          setTimeout(() => {
             setIsSyncing(false);
             setSyncStatus(null);
          }, 3000);
      }
  };

  const handleAutoUpdateCatalog = async () => {
    setIsSyncing(true);
    setSyncStatus('AI Scanning Global Game Market...');
    try {
        if (!process.env.API_KEY) throw new Error("API Key missing");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
        Task: Find trending and upcoming games.
        
        Output JSON Object with two arrays:
        1. "upcoming": 3 highly anticipated AAA games (Late 2025/2026).
        2. "released": 3 major AAA games released recently.
        
        Provide real data.
        `;

        const response = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
             config: { 
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: Type.OBJECT,
                     properties: {
                         upcoming: {
                             type: Type.ARRAY,
                             items: {
                                 type: Type.OBJECT,
                                 properties: {
                                     id: {type: Type.STRING},
                                     title: {type: Type.STRING},
                                     releaseDate: {type: Type.STRING},
                                     image: {type: Type.STRING}
                                 },
                                 required: ["id", "title", "releaseDate", "image"]
                             }
                         },
                         released: {
                             type: Type.ARRAY,
                             items: {
                                 type: Type.OBJECT,
                                 properties: {
                                     title: {type: Type.STRING},
                                     price: {type: Type.INTEGER},
                                     genre: {type: Type.STRING},
                                     description: {type: Type.STRING},
                                     platform: {type: Type.STRING},
                                     image: {type: Type.STRING}
                                 },
                                 required: ["title", "price", "genre", "description", "platform", "image"]
                             }
                         }
                     },
                     required: ["upcoming", "released"]
                 }
             }
        });
        const data = JSON.parse(response.text);
        
        if (data.upcoming && Array.isArray(data.upcoming)) {
            setUpcomingGamesList(prev => {
                const newItems = data.upcoming.filter((u: any) => !prev.some(p => p.title === u.title));
                return [...newItems, ...prev];
            });
        }
        if (data.released && Array.isArray(data.released)) {
             const newGames: Game[] = data.released.map((item: any, idx: number) => {
                 const originalPrice = item.price || 4999;
                 const discountPercent = Math.floor(Math.random() * (50 - 40 + 1)) + 40; 
                 const discountedPrice = Math.floor(originalPrice * ((100 - discountPercent) / 100));
                 return {
                     id: `auto-${Date.now()}-${idx}`,
                     title: item.title,
                     price: discountedPrice,
                     originalPrice: originalPrice,
                     discount: discountPercent,
                     rating: 4.8, 
                     image: item.image || DEFAULT_GAME_IMAGE,
                     video: '',
                     platform: (item.platform as any) || 'Steam',
                     genre: item.genre || 'Action',
                     releaseDate: new Date().toISOString().split('T')[0],
                     description: item.description || "Freshly added AAA title.",
                     players: 'Single-player',
                     systemReq: { os: 'Windows 10/11', processor: 'High End', memory: '16GB', graphics: 'RTX 3060+', storage: '100GB' },
                     reviews: [],
                     isNew: true
                 };
             });
             setGames(prev => [...newGames, ...prev]);
        }
        setSyncStatus('Catalog Updated Successfully!');
    } catch (e) {
        console.error(e);
        setSyncStatus('AI Update Failed. Try again.');
    } finally {
        setTimeout(() => { setIsSyncing(false); setSyncStatus(null); }, 3000);
    }
  };

  const handleAdminLogin = () => {
      if (adminPinInput === ADMIN_PIN) {
          setIsAdminAuthenticated(true);
          setIsAdminLoginOpen(false);
          setAdminPinInput('');
      } else {
          alert("Incorrect PIN");
          setAdminPinInput('');
      }
  };

  const handleAdminDeleteGame = (id: string) => {
      if (window.confirm("Are you sure you want to delete this game?")) {
          setGames(prev => prev.filter(g => g.id !== id));
      }
  };

  const startEditingGame = (game: Game) => {
      setEditingGameId(game.id);
      setEditForm({ ...game });
  };

  const saveEditedGame = () => {
      if (!editingGameId) return;
      setGames(prev => prev.map(g => g.id === editingGameId ? { ...g, ...editForm } : g));
      setEditingGameId(null);
      setEditForm({});
  };

  const handleAddNewGame = () => {
      const gameToAdd: Game = {
          id: `manual-${Date.now()}`,
          title: newGameForm.title || 'New Game',
          price: newGameForm.price || 999,
          originalPrice: (newGameForm.price || 999) * 1.5,
          discount: 0,
          rating: 4.5,
          image: newGameForm.image || DEFAULT_GAME_IMAGE,
          video: '',
          platform: (newGameForm.platform as any) || 'Steam',
          genre: newGameForm.genre || 'Action',
          releaseDate: new Date().toISOString().split('T')[0],
          description: newGameForm.description || 'No description.',
          players: 'Single-player',
          systemReq: { os: 'Windows 10', processor: 'i5', memory: '16GB', graphics: 'GTX 1050', storage: '50GB' },
          reviews: [],
          isNew: true
      };
      setGames(prev => [gameToAdd, ...prev]);
      setIsAddGameModalOpen(false);
      setNewGameForm({ title: '', price: 0, platform: 'Steam', genre: 'Action' });
  };
  
  const handleAddCoupon = () => {
      if (newCoupon.code && newCoupon.value) {
          const couponToAdd: Coupon = {
              code: newCoupon.code.toUpperCase(),
              discountType: newCoupon.discountType as 'flat' | 'percent',
              value: newCoupon.value,
              minOrder: newCoupon.minOrder || 0
          };
          setActiveCoupons(prev => [...prev, couponToAdd]);
          setNewCoupon({ code: '', discountType: 'percent', value: 0 });
      }
  };
  
  const handleDeleteCoupon = (code: string) => {
      setActiveCoupons(prev => prev.filter(c => c.code !== code));
  };

  // WALLET & RECHARGE LOGIC
  const handleRechargeWallet = () => {
      const codeObj = rechargeCodes.find(rc => rc.code === rechargeInput && !rc.isUsed);
      if (codeObj) {
          setWalletBalance(prev => prev + codeObj.value);
          setRechargeCodes(prev => prev.map(rc => rc.code === rechargeInput ? { ...rc, isUsed: true } : rc));
          alert(`Success! ₹${codeObj.value} added to your wallet.`);
          setRechargeInput('');
      } else {
          alert("Invalid or Used Code.");
      }
  };

  const handleCreateRechargeCode = () => {
      if (newRechargeCode.code && newRechargeCode.value) {
          setRechargeCodes(prev => [...prev, { code: newRechargeCode.code, value: newRechargeCode.value, isUsed: false }]);
          setNewRechargeCode({ code: '', value: 0 });
          alert("Code Generated!");
      }
  };

  const handleBroadcast = () => {
      alert("BROADCAST SENT: Flash Sale notification sent to all active users!");
  };

  // BUNDLE BUILDER LOGIC
  const toggleBundleSelection = (game: Game) => {
      if (bundleSelection.find(g => g.id === game.id)) {
          setBundleSelection(prev => prev.filter(g => g.id !== game.id));
      } else {
          if (bundleSelection.length < 3) {
              setBundleSelection(prev => [...prev, game]);
          }
      }
  };

  const addBundleToCart = () => {
      if (bundleSelection.length !== 3) return;
      
      const totalPrice = bundleSelection.reduce((sum, g) => sum + g.price, 0);
      const discountedPrice = Math.floor(totalPrice * 0.8); // 20% OFF
      
      const bundleItem: CartItem = {
          id: `bundle-${Date.now()}`,
          title: "Custom Gamer Box",
          price: discountedPrice,
          originalPrice: totalPrice,
          discount: 20,
          rating: 5,
          image: "https://cdn-icons-png.flaticon.com/512/3081/3081840.png", // Box icon
          video: '',
          platform: 'Steam',
          genre: 'Bundle',
          releaseDate: new Date().toISOString(),
          description: `Includes: ${bundleSelection.map(g => g.title).join(', ')}`,
          players: 'Single-player',
          systemReq: bundleSelection[0].systemReq,
          reviews: [],
          quantity: 1,
          selectedEdition: "Bundle",
          selectedEditionPrice: discountedPrice,
          isBundle: true
      };
      
      setCart(prev => [...prev, bundleItem]);
      setIsBundleOpen(false);
      setBundleSelection([]);
      setIsCartOpen(true);
  };

  // SPIN LOGIC UPDATED
  const handleSpin = () => {
    if (hasSpun || spinning) return;
    setSpinning(true);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spinRotation + (360 * 5) + extraDegrees;
    setSpinRotation(totalRotation);
    setTimeout(() => {
      setSpinning(false);
      setHasSpun(true);
      const normalizedDegrees = 360 - (totalRotation % 360);
      const segmentSize = 360 / spinPrizes.length;
      const prizeIndex = Math.floor(normalizedDegrees / segmentSize);
      const prize = spinPrizes[prizeIndex % spinPrizes.length];
      if (prize.value > 0) {
        setWonPrize(`₹${prize.value}`);
        setWalletBalance(prev => prev + prize.value);
      } else {
        setWonPrize("BAD LUCK");
      }
    }, 4000);
  };

  const handleClaimLoot = () => {
      if (lootClaimed) return;
      const prizes = [
          { label: "₹50 OFF", code: "LOOT50" },
          { label: "5% OFF", code: "LOOT5" },
          { label: "₹10 OFF", code: "LUCKY10" },
          { label: "Better Luck Next Time", code: null }
      ];
      const randomPrize = prizes[Math.floor(Math.random() * prizes.length)];
      setLootReward(randomPrize.label);
      if (randomPrize.code) setCouponInput(randomPrize.code);
      localStorage.setItem('brahma_loot_date', new Date().toDateString());
      setLootClaimed(true);
  };

  const handleAddUpcoming = () => {
      if (upcomingForm.title && upcomingForm.image) {
          const newUpcoming: UpcomingGame = {
              id: `upcoming-${Date.now()}`,
              title: upcomingForm.title,
              releaseDate: upcomingForm.releaseDate || 'TBA',
              image: upcomingForm.image
          };
          setUpcomingGamesList(prev => [newUpcoming, ...prev]);
          setIsUpcomingModalOpen(false);
          setUpcomingForm({ title: '', releaseDate: '', image: '' });
      }
  };

  const startEditingUpcoming = (game: UpcomingGame) => {
      setEditingUpcomingId(game.id);
      setUpcomingForm({ ...game });
      setIsUpcomingModalOpen(true);
  };

  const saveEditedUpcoming = () => {
      if (!editingUpcomingId) {
          handleAddUpcoming();
          return;
      }
      setUpcomingGamesList(prev => prev.map(g => g.id === editingUpcomingId ? { ...g, ...upcomingForm } as UpcomingGame : g));
      setIsUpcomingModalOpen(false);
      setEditingUpcomingId(null);
      setUpcomingForm({ title: '', releaseDate: '', image: '' });
  };

  const handleDeleteUpcoming = (id: string) => {
      if (confirm('Delete this upcoming game?')) {
          setUpcomingGamesList(prev => prev.filter(g => g.id !== id));
      }
  };

  const handleAccessCodeWhatsApp = (code: string) => {
      if (!lastOrderDetails) return;
      const { id, date, customer, items, subtotal, fee, total, walletUsed } = lastOrderDetails;
      
      let itemsList = items.map((i: any) => `• ${i.title} [${i.selectedEdition}] (x${i.quantity}) - ₹${i.price * i.quantity}`).join('\n');
      
      const msg = `${code}
NEW ORDER: ${id}
Date: ${date}
-----------------------------
*CUSTOMER DETAILS:*
Name: ${customer.name}
Phone: ${customer.phone}
-----------------------------
*ORDER ITEMS:*
${itemsList}
-----------------------------
Subtotal: ₹${subtotal}
Fee: ₹${fee}
Wallet Used: ₹${walletUsed}
*FINAL TOTAL: ₹${total}*
-----------------------------
Payment Mode: UPI
*STATUS: PAYMENT COMPLETED*

Please verify my payment screenshot and send the digital game.`;
      
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSingleItemWhatsApp = (game: Game) => {
    const message = `I am interested in buying: ${game.title}\nPlatform: ${game.platform}\nPrice: ₹${game.price}\n\nIs this available?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleShareGame = async (game: Game) => {
    const shareData = {
      title: game.title,
      text: `Check out ${game.title} on Brahmastra Game Store! Price: ₹${game.price}`,
      url: window.location.href 
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { console.error("Error sharing:", err); }
    } else {
       const text = encodeURIComponent(`${shareData.text} \n${shareData.url}`);
       window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setSellForm(prev => ({ ...prev, invoice: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSellSubmit = () => {
      if (sellTab === 'listing') {
          const msg = `*SELL REQUEST (MARKETPLACE)*\nI want to sell my ${sellForm.type}.\n\nGame: ${sellForm.gameName}\nPlatform: ${sellForm.platform}\nExpected Price: ₹${sellForm.price}\n\nPlease check and revert.`;
          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
          // Instant Sell Logic
          if (!sellForm.gameName || !sellForm.originalValue || !sellForm.invoice) {
              alert("Please fill all details and upload invoice proof.");
              return;
          }
          const val = Number(sellForm.originalValue);
          const minOffer = Math.floor(val * 0.10);
          const maxOffer = Math.floor(val * 0.30);
          
          const msg = `*INSTANT SELL REQUEST*\nI want to INSTANT SELL my game.\n\nUser: ${userProfile.name}\nGame: ${sellForm.gameName}\nPlatform: ${sellForm.platform}\nOriginal Value: ₹${val}\n\n*System Estimate: ₹${minOffer} - ₹${maxOffer}*\n\nI am sending the invoice proof image now.\nPlease verify and send my Wallet Coupon Code.`;
          
          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
          alert("Request Generated! Please attach the Invoice Image in the WhatsApp chat that just opened.");
      }
      setIsSellModalOpen(false);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // For phone input, allow only numbers
    if (e.target.name === 'phone') {
        const val = e.target.value;
        if (val && !/^\d*$/.test(val)) return; // Reject non-digits
        if (val.length > 10) return; // Limit to 10 digits
    }
    setShippingDetails({ ...shippingDetails, [e.target.name]: e.target.value });
    if (shippingErrors[e.target.name]) setShippingErrors({ ...shippingErrors, [e.target.name]: null });
  };

  const handleAddressSubmit = () => {
     const errors: any = {};
     if (!shippingDetails.name) errors.name = "Name is required";
     if (!shippingDetails.phone || shippingDetails.phone.length < 10) errors.phone = "Valid 10-digit WhatsApp Number required";
     
     if (Object.keys(errors).length > 0) { setShippingErrors(errors); return; }
     setIsAddressModalOpen(false);
     setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
     const orderId = `#ORD-${Math.floor(100000 + Math.random() * 900000)}`;
     const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
     let itemsString = "";
     cart.forEach(item => { itemsString += `• ${item.title} [${item.selectedEdition}] (x${item.quantity})\n`; });
     
     // IMPORTANT: Capture wallet usage here as cart/state will be reset
     const capturedWalletUsage = useWallet ? Math.min(walletBalance, Math.floor(cartTotal * 0.10)) : 0;
     
     const orderData = {
         id: orderId,
         date: dateStr,
         customer: { ...shippingDetails },
         items: [...cart],
         subtotal: cartTotal,
         fee: PLATFORM_FEE,
         total: finalTotal,
         walletUsed: capturedWalletUsage,
         itemsStr: itemsString 
     };
     setLastOrderDetails(orderData);
     
     // Deduct Wallet if used
     if (useWallet) {
         setWalletBalance(prev => prev - capturedWalletUsage);
     }

     setIsPaymentModalOpen(false);
     setIsProcessingPayment(true);
     setProcessingTime(20); // Reset timer
  };

  const handleAiMatch = async (customPrompt?: string) => {
    const promptText = customPrompt || aiMatchPrompt;
    if (!promptText.trim()) return;
    setIsAiMatching(true);
    setAiMatchResult(null);
    try {
        if (process.env.API_KEY) {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             const catalogSummary = games.map(g => ({id: g.id, title: g.title, genre: g.genre, tags: g.description.slice(0, 100)})).slice(0, 50); 
             const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are a game store AI. User wants: "${promptText}". Pick the BEST single game ID from this list that matches the vibe: ${JSON.stringify(catalogSummary)}. Return ONLY the ID string.`,
             });
             const suggestedId = response.text?.trim();
             const found = games.find(g => g.id == suggestedId);
             setAiMatchResult(found || games[Math.floor(Math.random() * games.length)]); 
        } else {
             const keywords = promptText.toLowerCase().split(' ');
             const match = games.find(g => keywords.some(k => g.genre.toLowerCase().includes(k) || g.title.toLowerCase().includes(k)));
             setAiMatchResult(match || games[Math.floor(Math.random() * games.length)]);
        }
    } catch (e) {
        console.error(e);
        setAiMatchResult(games[Math.floor(Math.random() * games.length)]);
    } finally {
        setIsAiMatching(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found");
      }

      if (!chatSessionRef.current) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-pro-preview',
          config: {
            systemInstruction: SYSTEM_INSTRUCTION + `\nCurrent Store Catalog:\n${JSON.stringify(games.map(g => ({title: g.title, price: g.price, platform: g.platform})))}`,
            thinkingConfig: { thinkingBudget: 32768 },
            tools: [{ functionDeclarations: [addGameTool, updateGamePriceTool] }]
          }
        });
      }

      const result = await chatSessionRef.current.sendMessage({ message: userMsg });
      
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const args = call.args;
        let toolResponse = { result: "Failed" };

        if (call.name === "add_game") {
            const steamId = args.steamAppId as string;
            // Generate REAL Steam Image URL
            const imageUrl = steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/library_600x900.jpg` : DEFAULT_GAME_IMAGE;

            const newGame: Game = {
                id: `ai-${Date.now()}`,
                title: args.title as string,
                price: args.price as number,
                originalPrice: (args.price as number) * 1.5,
                discount: 0,
                rating: 5.0,
                image: imageUrl, // Uses the real steam image
                video: '',
                platform: (args.platform as any) || 'Steam',
                genre: args.genre as string || 'Action',
                releaseDate: new Date().toISOString().split('T')[0],
                description: args.description as string || "Newly added to the store by BrahmaBot.",
                players: 'Single-player',
                systemReq: { os: 'Windows 10', processor: 'i5', memory: '16GB', graphics: 'GTX 1060', storage: '50GB' },
                reviews: [{ user: 'BrahmaBot', rating: 5, comment: 'Admin approved addition.' }],
                isNew: true
            };
            setGames(prev => [newGame, ...prev]);
            toolResponse = { result: `Successfully added ${newGame.title} to the store with official cover art.` };
        } 
        else if (call.name === "update_game_price") {
            const targetTitle = args.gameTitle as string;
            const newPrice = args.newPrice as number;
            setGames(prev => prev.map(g => {
                if (g.title.toLowerCase().includes(targetTitle.toLowerCase())) {
                    return { ...g, price: newPrice, discount: Math.floor(((g.originalPrice - newPrice) / g.originalPrice) * 100) };
                }
                return g;
            }));
            toolResponse = { result: `Price updated for ${targetTitle} to ₹${newPrice}.` };
        }

        const followUp = await chatSessionRef.current.sendMessage({
            message: [{
                functionResponse: {
                    name: call.name,
                    response: toolResponse
                }
            }]
        });
        setChatMessages(prev => [...prev, { role: 'model', text: followUp.text }]);

      } else {
          setChatMessages(prev => [...prev, { role: 'model', text: result.text }]);
      }

    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Server issue hai boss. Thodi der baad try karo." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => { setChatInput(prompt); };
  
  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0` : null;
  };

  const upiDeepLink = `upi://pay?pa=${UPI_ID}&pn=BrahmastraGameStore&am=${finalTotal}&cu=INR&tn=GamePurchase`;

  if (showSplash) return <DragonLoader />;

  return (
    <div className="min-h-screen bg-brahma-base text-gray-300 relative overflow-x-hidden pb-20 md:pb-0">
      
      {storeSettings.flashSaleEnabled && (
        <>
          <style>{`
            @keyframes marquee-infinite { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } 
            .animate-marquee-infinite { animation: marquee-infinite 40s linear infinite; }
          `}</style>
          {storeSettings.bannerLink ? (
            <a href={storeSettings.bannerLink} className="fixed top-0 left-0 right-0 z-[60] bg-yellow-400 text-black h-8 flex items-center justify-center overflow-hidden shadow-lg border-b border-yellow-500/50 block hover:bg-yellow-300 transition-colors">
               <div className="flex w-full h-full items-center justify-center relative">
                   {storeSettings.bannerImage && (
                       <div className="absolute left-0 top-0 bottom-0 z-20 bg-yellow-400 px-4 flex items-center border-r border-black/10">
                           <img src={storeSettings.bannerImage} className="h-6 w-auto object-contain drop-shadow-md" alt="Deal" />
                       </div>
                   )}
                   <div className="flex-1 overflow-hidden relative h-full flex items-center">
                       <div className="animate-marquee-infinite whitespace-nowrap font-bold font-tech text-xs tracking-widest flex gap-12 uppercase">
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                       </div>
                   </div>
               </div>
            </a>
          ) : (
            <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-400 text-black h-8 flex items-center justify-center overflow-hidden shadow-lg border-b border-yellow-500/50">
               <div className="flex w-full h-full items-center justify-center relative">
                   {storeSettings.bannerImage && (
                       <div className="absolute left-0 top-0 bottom-0 z-20 bg-yellow-400 px-4 flex items-center border-r border-black/10">
                           <img src={storeSettings.bannerImage} className="h-6 w-auto object-contain drop-shadow-md" alt="Deal" />
                       </div>
                   )}
                   <div className="flex-1 overflow-hidden relative h-full flex items-center">
                       <div className="animate-marquee-infinite whitespace-nowrap font-bold font-tech text-xs tracking-widest flex gap-12 uppercase">
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                           <span>{storeSettings.bannerText}</span>
                       </div>
                   </div>
               </div>
            </div>
          )}
        </>
      )}

      {/* --- BUNDLE BUILDER BUTTON --- */}
      <button onClick={() => setIsBundleOpen(true)} className="fixed bottom-24 right-6 z-[60] bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-[0_0_20px_#7c3aed] flex items-center gap-2 font-bold uppercase text-xs hover:scale-105 transition-transform animate-pulse hidden md:flex">
          <PackagePlus className="w-5 h-5" /> <span className="hidden sm:inline">Build Box</span>
      </button>

      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-cyber-grid bg-[size:40px_40px] opacity-10 pointer-events-none z-0"></div>
      
      {/* ... (Existing Nav Code Omitted for Brevity - Keeping it same) ... */}
      <nav className={`absolute top-12 left-0 right-0 z-50 flex justify-center transition-all duration-300 px-4`}>
        <div className={`w-full max-w-[1400px] rounded-2xl border border-white/10 backdrop-blur-xl transition-all duration-300 ${scrolled ? 'bg-black/80 shadow-[0_0_30px_rgba(6,182,212,0.15)]' : 'bg-black/40'}`}>
          <div className="px-4 md:px-6 py-4 flex items-center justify-between relative min-h-[72px]">
            <div className="flex-1 flex justify-start items-center gap-3">
               <button onClick={() => setIsSteamSyncOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-[#171a21] hover:border-gray-500 transition-all group" title="Steam Sync">
                   {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-5 h-5 opacity-50 group-hover:opacity-100" alt="Steam" />}
               </button>
               <div className="flex flex-col items-start px-3 py-1 bg-white/5 rounded border border-white/10">
                   <span className="text-[10px] text-gray-400 uppercase tracking-wider font-tech">Wallet</span>
                   <span className="text-sm font-bold text-brahma-cyan">₹{walletBalance}</span>
               </div>
               <button onClick={() => setIsSellModalOpen(true)} className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold uppercase rounded-lg hover:brightness-110 transition-all shadow-lg animate-pulse-fast">
                   <Coins className="w-4 h-4 fill-current" /> Sell
               </button>
               <div className="hidden md:flex max-w-xs w-full relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-brahma-cyan to-brahma-purple rounded-lg opacity-30 group-hover:opacity-70 transition duration-300 blur-sm"></div>
                  <div className="relative flex items-center bg-black/80 rounded-lg overflow-hidden w-full">
                    <Search className="w-4 h-4 text-gray-400 ml-4 shrink-0" />
                    <input type="text" placeholder="Search..." className="w-full bg-transparent border-none py-2 px-4 focus:outline-none text-sm font-tech text-white placeholder:text-gray-600 tracking-wide" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
               </div>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10 select-none" onClick={handleSecretLogoTap}>
               <div className="flex items-center gap-2">
                 <div className="hidden md:block w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
                     <img src="logo.png" className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" onError={(e) => e.currentTarget.style.display='none'} />
                 </div>
                 <h1 className="font-amazing text-xl sm:text-2xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-white via-brahma-cyan to-white font-bold tracking-widest drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">BRAHMASTRA</h1>
                 <span className="hidden md:flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white" title="Verified Store"><CheckCircle2 className="w-3 h-3" /></span>
               </div>
               <span className="hidden md:block text-[8px] font-tech text-brahma-purple tracking-[0.8em] uppercase mt-1">Premium Game Store</span>
            </div>
            <div className="flex-1 flex justify-end gap-2 md:gap-4">
               <button onClick={() => setIsLootOpen(true)} className="relative p-2 rounded-full hover:bg-white/5 transition-colors group hidden xs:block">
                  <Gift className={`w-5 h-5 ${!lootClaimed ? 'text-brahma-neon animate-bounce' : 'text-gray-400'}`} />
                  {!lootClaimed && <span className="absolute top-1 right-1 w-2 h-2 bg-brahma-neon rounded-full"></span>}
               </button>
               <button onClick={() => setIsWishlistOpen(true)} className="relative p-2 rounded-full hover:bg-white/5 transition-colors group hidden md:block">
                  <Heart className={`w-5 h-5 ${wishlist.length > 0 ? 'fill-red-500 text-red-500' : 'text-gray-400 group-hover:text-white'}`} />
                  {wishlist.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
               </button>
               <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-full hover:bg-white/5 transition-colors group hidden md:block">
                  <div className={`${cartAnimating ? 'animate-bounce' : ''}`}><ShoppingBag className="w-5 h-5 text-gray-400 group-hover:text-brahma-cyan" /></div>
                  {cart.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-brahma-cyan rounded-full shadow-[0_0_10px_#06b6d4]"></span>}
               </button>
               <button onClick={() => setIsProfileOpen(true)} className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 hover:border-brahma-cyan transition-colors ml-2 hidden md:block">
                 <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
               </button>
            </div>
          </div>
          {/* Mobile Search Overlay */}
          {mobileSearchActive && (
             <div className="md:hidden border-t border-white/10 p-4 bg-black/95 animate-in slide-in-from-top-2">
                 <div className="relative flex items-center bg-white/5 rounded-lg overflow-hidden w-full border border-white/20">
                    <Search className="w-4 h-4 text-gray-400 ml-4 shrink-0" />
                    <input type="text" autoFocus placeholder="Search games..." className="w-full bg-transparent border-none py-3 px-4 focus:outline-none text-sm font-tech text-white placeholder:text-gray-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                 </div>
                 <div className="flex justify-between items-center mt-3 px-1">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Wallet: <span className="text-brahma-cyan">₹{walletBalance}</span></span>
                     <div className="flex gap-4">
                        <button onClick={() => setIsProfileOpen(true)} className="text-[10px] text-gray-400 uppercase font-bold hover:text-white">Profile</button>
                        <button onClick={() => setIsLootOpen(true)} className="text-[10px] text-brahma-neon uppercase font-bold animate-pulse">Daily Loot</button>
                     </div>
                 </div>
             </div>
          )}
        </div>
      </nav>

      {/* STICKY BOTTOM NAVIGATION BAR (MOBILE ONLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-black/95 backdrop-blur-xl border-t border-white/10 px-4 pb-safe pt-2 h-[70px] flex justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
          <button onClick={() => { setActiveTab('home'); window.scrollTo({top: 0, behavior: 'smooth'}); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === 'home' ? 'text-brahma-cyan' : 'text-gray-500'}`}>
              <Home className={`w-6 h-6 ${activeTab === 'home' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold">Home</span>
          </button>
          
          <button onClick={() => { setActiveTab('search'); setMobileSearchActive(!mobileSearchActive); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === 'search' || mobileSearchActive ? 'text-brahma-cyan' : 'text-gray-500'}`}>
              <Search className="w-6 h-6" />
              <span className="text-[10px] font-bold">Search</span>
          </button>

          <button onClick={() => { setActiveTab('cart'); setIsCartOpen(true); }} className="relative -top-6 bg-gradient-to-r from-brahma-cyan to-blue-600 p-4 rounded-full border-4 border-black shadow-[0_0_20px_rgba(6,182,212,0.6)] group hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6 text-white fill-white" />
              {cart.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-black">{cart.length}</span>}
          </button>

          <button onClick={() => { setActiveTab('profile'); setIsProfileOpen(true); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === 'profile' ? 'text-brahma-cyan' : 'text-gray-500'}`}>
              <User className={`w-6 h-6 ${activeTab === 'profile' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold">Profile</span>
          </button>

          <button onClick={() => setIsSellModalOpen(true)} className="flex flex-col items-center gap-1 p-2 rounded-xl text-yellow-500">
              <Coins className="w-6 h-6" />
              <span className="text-[10px] font-bold">Sell</span>
          </button>
      </div>

      <div className="relative pt-48 pb-20 px-4 max-w-[1400px] mx-auto space-y-16 z-10">

        <div className="flex gap-4 md:gap-8 overflow-x-auto pb-4 hide-scrollbar justify-start md:justify-center">
            {STORIES.map((story, idx) => (
                <div key={story.id} className="flex flex-col items-center gap-2 cursor-pointer group min-w-[64px]" onClick={() => setViewingStory(idx)}>
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 group-hover:scale-105 transition-transform">
                        <div className="w-full h-full rounded-full border-2 border-black overflow-hidden">
                            <img src={story.thumbnail} className="w-full h-full object-cover" alt={story.title} onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
                        </div>
                    </div>
                    <span className="text-[10px] md:text-xs font-tech text-gray-300 tracking-wide uppercase group-hover:text-white">{story.title}</span>
                </div>
            ))}
        </div>

        <header className="relative w-full min-h-[500px] rounded-3xl overflow-hidden group clip-corner mt-4">
          <div className="absolute inset-0">
            <img src={heroGame.image || DEFAULT_GAME_IMAGE} alt="Hero" loading="eager" fetchPriority="high" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000 ease-out" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(6,182,212,0.1)_50%,transparent_100%)] h-full w-full bg-[length:100%_4px] opacity-20"></div>
          <div className="relative z-10 h-full flex flex-col justify-center p-6 md:p-16 max-w-3xl space-y-6">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brahma-cyan/30 bg-brahma-cyan/10 backdrop-blur-md w-fit">
               <span className="w-2 h-2 bg-brahma-cyan rounded-full animate-pulse"></span>
               <span className="text-xs font-tech text-brahma-cyan uppercase tracking-widest">Featured Deal</span>
             </div>
             <h1 className="text-3xl sm:text-5xl md:text-7xl font-display font-black text-white leading-[0.9] tracking-tight uppercase drop-shadow-lg"><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">{heroGame.title}</span></h1>
             <div className="flex items-center gap-4 bg-black/40 border border-white/10 w-fit px-4 py-2 rounded-lg backdrop-blur-sm">
                 <Timer className="w-5 h-5 text-brahma-neon animate-pulse" /><span className="font-tech text-sm text-gray-300 uppercase tracking-widest">Offer Ends In:</span><span className="font-display font-bold text-white tracking-widest text-lg">0{countdown.h}:{countdown.m < 10 ? '0'+countdown.m : countdown.m}:{countdown.s < 10 ? '0'+countdown.s : countdown.s}</span>
             </div>
             <p className="text-gray-400 font-sans max-w-xl text-base md:text-lg leading-relaxed border-l-4 border-brahma-purple pl-6 line-clamp-3 md:line-clamp-none">{heroGame.description}</p>
             <div className="flex flex-wrap items-center gap-4 pt-4">
                <button onClick={() => buyNow(heroGame)} className="clip-button relative px-8 md:px-10 py-4 bg-white text-black font-display font-bold uppercase tracking-wider hover:bg-brahma-cyan transition-colors duration-300 group/btn"><span className="relative z-10 flex items-center gap-2">Buy Now <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform"/></span></button>
                <div className="flex flex-col px-6 border-l border-white/20"><span className="text-xs font-tech text-brahma-neon uppercase tracking-widest">Price</span><span className="text-2xl md:text-3xl font-display font-bold text-white">₹{heroGame.price}</span></div>
             </div>
          </div>
        </header>

        {/* ... (Existing Sections: Upcoming, AI Match, Catalog ... ) ... */}
        
        <section className="overflow-hidden border-b border-white/5 pb-12">
           <div className="flex items-center justify-between mb-8 px-2"><h3 className="font-display text-2xl font-bold text-white uppercase flex items-center gap-3"><span className="w-1 h-8 bg-brahma-cyan"></span> Upcoming Games</h3></div>
           <div className="flex w-full overflow-hidden">
             <div className="flex gap-6 w-max animate-marquee-infinite hover:[animation-play-state:paused]">
                {[...upcomingGamesList, ...upcomingGamesList].map((game, i) => (
                    <div key={`${game.id}-${i}`} className="relative min-w-[200px] h-[300px] rounded-2xl overflow-hidden group border border-white/10 hover:border-brahma-cyan/50 transition-all bg-[#0a0a0a]">
                        <img src={game.image || DEFAULT_GAME_IMAGE} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                            <div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded-full bg-brahma-purple/20 border border-brahma-purple/50 text-[10px] text-brahma-purple font-tech uppercase tracking-wider">Coming Soon</span></div>
                            <h4 className="font-display font-bold text-white text-lg leading-tight mb-1 truncate">{game.title}</h4>
                            <span className="text-xs font-tech text-brahma-cyan block tracking-widest">RELEASE: {game.releaseDate}</span>
                        </div>
                    </div>
                ))}
             </div>
           </div>
        </section>

        <section className="py-12 px-4 relative">
            <div className="absolute inset-0 bg-brahma-cyan/5 blur-3xl"></div>
            <div className="max-w-4xl mx-auto bg-black/60 border border-brahma-cyan/30 rounded-3xl p-6 md:p-12 relative overflow-hidden backdrop-blur-xl">
                <div className="text-center space-y-4 mb-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-brahma-cyan/10 border border-brahma-cyan/20 rounded-full"><Bot className="w-4 h-4 text-brahma-cyan" /><span className="text-xs font-tech text-brahma-cyan uppercase tracking-widest">Brahma Neural Engine</span></div>
                    <h3 className="text-2xl md:text-5xl font-display font-black text-white uppercase italic">Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-brahma-cyan to-brahma-purple">Perfect Game</span></h3>
                </div>
                <div className="relative z-10 max-w-xl mx-auto space-y-6">
                    <div className="relative group">
                        <div className="relative flex items-center bg-[#050505] border border-white/10 rounded-xl overflow-hidden p-2">
                            <input type="text" value={aiMatchPrompt} onChange={(e) => setAiMatchPrompt(e.target.value)} placeholder="e.g. 'Story-rich zombie game'..." className="flex-1 bg-transparent border-none text-white font-tech px-4 focus:outline-none placeholder:text-gray-600 text-sm md:text-base" onKeyDown={(e) => e.key === 'Enter' && handleAiMatch()} />
                            <button onClick={() => handleAiMatch()} disabled={isAiMatching || !aiMatchPrompt} className="bg-white text-black p-3 rounded-lg hover:bg-brahma-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isAiMatching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">{['High Action', 'Relaxing', 'Sci-Fi', 'Horror', 'Open World', 'Strategy'].map(tag => (<button key={tag} onClick={() => { setAiMatchPrompt(tag); handleAiMatch(tag); }} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-tech text-gray-400 uppercase tracking-wider hover:border-brahma-cyan hover:text-white hover:bg-brahma-cyan/10 transition-all">{tag}</button>))}</div>
                </div>
                {aiMatchResult && (
                    <div className="mt-12 animate-in fade-in slide-in-from-bottom-8">
                        <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brahma-cyan text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1"><Zap className="w-3 h-3 fill-current" /> 99% Match Found</div>
                             <img src={aiMatchResult.image || DEFAULT_GAME_IMAGE} className="w-full md:w-48 h-64 object-cover rounded-lg shadow-2xl" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
                             <div className="flex-1 text-center md:text-left space-y-4">
                                <div><h4 className="text-2xl font-display font-bold text-white mb-1">{aiMatchResult.title}</h4><div className="flex items-center justify-center md:justify-start gap-2 text-xs text-gray-500 font-tech uppercase"><span className="text-brahma-cyan">{aiMatchResult.genre}</span> • <span>{aiMatchResult.platform}</span></div></div>
                                <p className="text-gray-300 text-sm leading-relaxed">{aiMatchResult.description}</p>
                                <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2"><button onClick={() => buyNow(aiMatchResult)} className="px-8 py-3 bg-white text-black font-display font-bold uppercase text-xs tracking-widest hover:bg-brahma-cyan transition-colors">Buy Now</button><button onClick={() => addToCart(aiMatchResult)} className="px-8 py-3 border border-white/20 text-white font-display font-bold uppercase text-xs tracking-widest hover:border-white transition-colors">Add to Cart</button></div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </section>

        <section className="space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/10 pb-2">
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <h3 className="font-display text-3xl font-bold text-white">CATALOG</h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <select value={selectedGenre} onChange={(e) => { setSelectedGenre(e.target.value); setVisibleItems(ITEMS_PER_PAGE); }} className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-4 py-1.5 pr-8 font-tech text-sm text-brahma-cyan uppercase tracking-wider focus:outline-none focus:border-brahma-cyan cursor-pointer hover:bg-white/10 transition-colors">
                      {uniqueGenres.map(genre => (<option key={genre} value={genre} className="bg-[#0a0a0a] text-gray-300">{genre}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brahma-cyan pointer-events-none" />
                  </div>
                   <div className="relative flex-1 md:flex-none">
                    <select value={selectedStorePlatform} onChange={(e) => { setSelectedStorePlatform(e.target.value); setVisibleItems(ITEMS_PER_PAGE); }} className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-4 py-1.5 pr-8 font-tech text-sm text-brahma-cyan uppercase tracking-wider focus:outline-none focus:border-brahma-cyan cursor-pointer hover:bg-white/10 transition-colors">
                      {['All', 'Steam', 'Epic', 'Ubisoft', 'BattleNet', 'PS5', 'Xbox'].map(p => (<option key={p} value={p} className="bg-[#0a0a0a] text-gray-300">{p}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brahma-cyan pointer-events-none" />
                  </div>
              </div>
            </div>
            
            <div className="flex gap-8 overflow-x-auto pb-2 hide-scrollbar w-full md:w-auto">
              {(['All', 'Best Selling', 'Offers'] as PlatformFilter[]).map(p => {
                const isActive = selectedPlatform === p;
                return (<div key={p} onClick={() => { setSelectedPlatform(p); setVisibleItems(ITEMS_PER_PAGE); }} className={`relative pb-2 flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap group ${isActive ? 'text-brahma-cyan' : 'text-gray-500 hover:text-white'}`}><span className="text-sm font-bold font-tech uppercase tracking-widest">{p}</span>{isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brahma-cyan shadow-[0_0_10px_#06b6d4]"></span>}</div>);
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {isLoading ? Array(8).fill(0).map((_, i) => (<div key={i} className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse"></div>)) : visibleGames.map((game) => (
               <div key={game.id} className="group relative bg-[#0a0a0a] rounded-xl overflow-hidden hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 shadow-2xl hover:shadow-brahma-cyan/20 border border-white/5 hover:border-brahma-cyan/50" onClick={() => setSelectedGame(game)}>
                  <div className="relative aspect-[3/4] overflow-hidden">
                     {/* OPACITY FIXED: REMOVED opacity-80, ADDED opacity-100 */}
                     <img src={game.image || DEFAULT_GAME_IMAGE} alt={game.title} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-100 transition-transform duration-300 group-hover:scale-105" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
                     <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {/* REMOVED NEW RELEASE BADGE */}
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-tech uppercase tracking-wider text-white w-fit">{game.platform}</div>
                     </div>
                     
                     {/* WISHLIST BUTTON ON CARD */}
                     <button 
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(game.id); }}
                        className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90 transition-all duration-300 group/heart"
                     >
                        <Heart className={`w-4 h-4 transition-all duration-300 ${wishlist.includes(game.id) ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-300 group-hover:text-white'}`} />
                     </button>

                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 bg-gradient-to-t from-black to-transparent gap-2">
                        <button onClick={(e) => { e.stopPropagation(); buyNow(game); }} className="w-full py-2 bg-white text-black font-display font-bold uppercase text-xs tracking-wider hover:bg-brahma-cyan transition-colors clip-button">Buy Now</button>
                        <button onClick={(e) => { e.stopPropagation(); addToCart(game); }} className="w-full py-2 bg-black/60 border border-white/20 text-white font-display font-bold uppercase text-xs tracking-wider hover:bg-white/20 transition-colors clip-button">Add to Cart</button>
                     </div>
                  </div>
                  <div className="p-4 space-y-2 bg-[#0c0c0c] border-t border-white/5 relative">
                     <h4 className="font-bold text-white leading-tight line-clamp-1 group-hover:text-brahma-cyan transition-colors text-sm md:text-base">{game.title}</h4>
                     <div className="flex justify-between items-center"><span className="text-gray-500 text-[10px] md:text-xs font-tech">{game.genre}</span><div className="flex items-center gap-2">{game.discount > 0 && <span className="text-[10px] bg-brahma-neon/20 text-brahma-neon px-1 rounded hidden sm:inline">- {game.discount}%</span>}<span className="font-display font-bold text-white text-sm md:text-base">₹{game.price}</span></div></div>
                  </div>
               </div>
            ))}
          </div>
          
          {!isLoading && visibleGames.length < filteredGames.length && (<div className="flex justify-center pt-12"><button onClick={loadMore} className="group px-8 py-3 border border-white/20 text-white font-display text-sm uppercase tracking-widest hover:border-brahma-cyan hover:text-brahma-cyan transition-all"><span className="flex items-center gap-2">View More Games <ChevronDown className="w-4 h-4" /></span></button></div>)}
        </section>

      {/* --- ALL MISSING MODALS & OVERLAYS --- */}
      
      {/* 7. GAME DETAILS MODAL (The "Killer Feature") */}
      {selectedGame && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-300">
              <div className="relative w-full max-w-6xl h-[90vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-[0_0_100px_rgba(6,182,212,0.1)]">
                  <button onClick={() => setSelectedGame(null)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"><X className="w-6 h-6"/></button>
                  
                  {/* Left: Media */}
                  <div className="w-full md:w-2/3 relative bg-black flex flex-col">
                       {/* Video Player or Image */}
                       <div className="relative flex-1 overflow-hidden group">
                           {!isPlayingVideo ? (
                               <>
                                   <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-transparent z-10"></div>
                                   <img src={selectedGame.image} className="w-full h-full object-cover opacity-80" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
                                   <div className="absolute inset-0 flex items-center justify-center z-20">
                                       <button onClick={() => setIsPlayingVideo(true)} className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 hover:scale-110 hover:bg-brahma-cyan hover:text-black hover:border-transparent transition-all duration-300 group-hover:shadow-[0_0_40px_rgba(6,182,212,0.6)]">
                                           <PlayCircle className="w-10 h-10 fill-current" />
                                       </button>
                                   </div>
                               </>
                           ) : (
                               <iframe src={getEmbedUrl(selectedGame.video) || ''} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Trailer"></iframe>
                           )}
                       </div>
                       {/* Thumbnails / Gallery (Static for now) */}
                       <div className="h-24 bg-[#050505] border-t border-white/10 p-4 flex gap-4 overflow-x-auto hide-scrollbar">
                           {[selectedGame.image, selectedGame.image].map((img, i) => (
                               <img key={i} src={img} className="h-full aspect-video object-cover rounded border border-white/20 cursor-pointer hover:border-brahma-cyan" onClick={() => setIsPlayingVideo(false)} />
                           ))}
                       </div>
                  </div>

                  {/* Right: Details */}
                  <div className="w-full md:w-1/3 bg-[#111] border-l border-white/10 p-6 md:p-8 overflow-y-auto flex flex-col relative custom-scrollbar">
                       <div className="mb-6">
                           <div className="flex items-start justify-between mb-2">
                               <span className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[10px] font-tech uppercase text-gray-400">{selectedGame.platform}</span>
                               <span className="flex items-center gap-1 text-yellow-400 text-sm font-bold"><Zap className="w-3 h-3 fill-current"/> {selectedGame.rating}</span>
                           </div>
                           <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight mb-2">{selectedGame.title}</h2>
                           <div className="flex flex-col gap-2">
                               <div className="flex items-baseline gap-3">
                                   <span className="text-3xl font-bold text-brahma-cyan">₹{selectedGame.price}</span>
                                   <span className="text-lg text-gray-600 line-through">₹{selectedGame.originalPrice}</span>
                                   <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-bold rounded">SAVE {selectedGame.discount}%</span>
                               </div>
                               {/* --- LOW STOCK INDICATOR (FIXED STABLE NUMBER) --- */}
                               <div className="flex items-center gap-2 text-xs font-bold text-red-500 animate-pulse bg-red-500/10 px-3 py-1.5 rounded w-fit border border-red-500/20">
                                  <Flame className="w-3 h-3 fill-current" /> Only {stockCount} Keys Left at this Price!
                               </div>
                           </div>
                       </div>

                       {/* Platform Selection (Mock) */}
                       <div className="mb-6 space-y-2">
                           <span className="text-xs text-gray-500 uppercase font-bold">Select Edition</span>
                           <div className="grid grid-cols-2 gap-2">
                               <button className="p-3 border-2 border-brahma-cyan bg-brahma-cyan/10 rounded-lg text-left relative overflow-hidden">
                                   <div className="absolute top-0 right-0 p-1"><CheckCircle2 className="w-4 h-4 text-brahma-cyan" /></div>
                                   <span className="block text-xs font-bold text-white">Standard</span>
                                   <span className="block text-xs text-brahma-cyan">₹{selectedGame.price}</span>
                               </button>
                               <button className="p-3 border border-white/10 bg-black rounded-lg text-left hover:border-white/30 transition-colors opacity-60">
                                   <span className="block text-xs font-bold text-gray-400">Deluxe (Coming Soon)</span>
                               </button>
                           </div>
                       </div>

                       <div className="flex-1 space-y-6">
                           <p className="text-sm text-gray-400 leading-relaxed">{selectedGame.description}</p>
                           
                           {/* Specs Accordion */}
                           <div className="border-t border-b border-white/10 py-4">
                               <button onClick={() => setExpandSysReq(!expandSysReq)} className="w-full flex items-center justify-between text-sm font-bold text-white uppercase mb-2">
                                   <span className="flex items-center gap-2"><Cpu className="w-4 h-4"/> System Requirements</span>
                                   <ChevronDown className={`w-4 h-4 transition-transform ${expandSysReq ? 'rotate-180' : ''}`}/>
                               </button>
                               {expandSysReq && (
                                   <div className="text-xs text-gray-500 space-y-2 animate-in slide-in-from-top-2">
                                       <div className="flex justify-between border-b border-white/5 pb-1"><span>OS:</span> <span className="text-gray-300">{selectedGame.systemReq.os}</span></div>
                                       <div className="flex justify-between border-b border-white/5 pb-1"><span>Processor:</span> <span className="text-gray-300">{selectedGame.systemReq.processor}</span></div>
                                       <div className="flex justify-between border-b border-white/5 pb-1"><span>Memory:</span> <span className="text-gray-300">{selectedGame.systemReq.memory}</span></div>
                                       <div className="flex justify-between border-b border-white/5 pb-1"><span>Graphics:</span> <span className="text-gray-300">{selectedGame.systemReq.graphics}</span></div>
                                       <div className="flex justify-between"><span>Storage:</span> <span className="text-gray-300">{selectedGame.systemReq.storage}</span></div>
                                   </div>
                               )}
                           </div>

                           {/* VERIFIED REVIEWS SECTION */}
                           <div className="space-y-3">
                               <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2"><Star className="w-3 h-3 text-yellow-400 fill-current"/> Verified Reviews</h4>
                               <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                   {displayedReviews.map((review, idx) => (
                                       <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5">
                                           <div className="flex justify-between items-center mb-1">
                                               <span className="text-[10px] font-bold text-brahma-cyan">{review.user}</span>
                                               <div className="flex text-yellow-400">{Array(review.rating).fill(0).map((_, i) => <Star key={i} className="w-2 h-2 fill-current" />)}</div>
                                           </div>
                                           <p className="text-[10px] text-gray-400 leading-tight">"{review.comment}"</p>
                                       </div>
                                   ))}
                               </div>
                           </div>

                           {/* SIMILAR GAMES RECOMMENDATION */}
                           {similarGames.length > 0 && (
                               <div className="space-y-3 pt-4 border-t border-white/10">
                                   <h4 className="text-xs font-bold text-white uppercase">You Might Also Like</h4>
                                   <div className="grid grid-cols-3 gap-2">
                                       {similarGames.map(game => (
                                           <div key={game.id} onClick={() => setSelectedGame(game)} className="cursor-pointer group">
                                               <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/10 group-hover:border-brahma-cyan transition-colors">
                                                   <img src={game.image || DEFAULT_GAME_IMAGE} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                               </div>
                                               <p className="text-[9px] text-gray-400 mt-1 truncate group-hover:text-white">{game.title}</p>
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           )}
                       </div>

                       <div className="mt-6 space-y-3 sticky bottom-0 bg-[#111] pt-4 border-t border-white/10 z-10">
                           <button onClick={() => buyNow(selectedGame)} className="w-full py-4 bg-white text-black font-display font-bold uppercase tracking-wider rounded-xl hover:bg-brahma-cyan hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                               Buy Now - Instant Access
                           </button>
                           <div className="flex gap-3">
                               <button onClick={() => addToCart(selectedGame)} className="flex-1 py-3 bg-white/5 border border-white/20 text-white font-bold uppercase rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                                   <ShoppingBag className="w-4 h-4"/> Add to Cart
                               </button>
                               <button onClick={() => handleSingleItemWhatsApp(selectedGame)} className="flex-1 py-3 bg-[#25D366]/20 border border-[#25D366]/50 text-[#25D366] font-bold uppercase rounded-xl hover:bg-[#25D366] hover:text-white transition-colors flex items-center justify-center gap-2">
                                   <MessageCircle className="w-4 h-4"/> WhatsApp
                               </button>
                           </div>
                           <p className="text-[10px] text-center text-gray-500 flex items-center justify-center gap-1">
                               <ShieldCheck className="w-3 h-3 text-green-500"/> 100% Secure Checkout • Instant Digital Delivery
                           </p>
                       </div>
                  </div>
              </div>
          </div>
      )}

      {/* 8. SELL MODAL (UPDATED WITH INSTANT SELL) */}
      {isSellModalOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-lg bg-[#111] border border-white/20 rounded-2xl p-6 relative overflow-y-auto max-h-[90vh]">
                  <button onClick={() => setIsSellModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                  
                  {/* TABS */}
                  <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
                      <button onClick={() => setSellTab('listing')} className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider ${sellTab === 'listing' ? 'text-brahma-cyan border-b-2 border-brahma-cyan' : 'text-gray-500 hover:text-white'}`}>Marketplace Listing</button>
                      <button onClick={() => setSellTab('instant')} className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider ${sellTab === 'instant' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-white'}`}>⚡ Instant Sell</button>
                  </div>

                  {sellTab === 'listing' ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                          <h3 className="text-xl font-display font-bold text-white uppercase flex items-center gap-2 mb-2"><Coins className="w-5 h-5 text-gray-400"/> List Your Game</h3>
                          <div className="space-y-2"><label className="text-xs text-gray-500 uppercase">Game Name</label><input type="text" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-brahma-cyan outline-none" placeholder="e.g. Elden Ring" value={sellForm.gameName} onChange={(e) => setSellForm({...sellForm, gameName: e.target.value})} /></div>
                          <div className="space-y-2"><label className="text-xs text-gray-500 uppercase">Platform</label><select className="w-full bg-black border border-white/20 rounded p-3 text-white outline-none" value={sellForm.platform} onChange={(e) => setSellForm({...sellForm, platform: e.target.value})}><option>PS5</option><option>PS4</option><option>Xbox</option><option>Steam Account</option></select></div>
                          <div className="space-y-2"><label className="text-xs text-gray-500 uppercase">Expected Price (₹)</label><input type="number" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-brahma-cyan outline-none" placeholder="e.g. 2500" value={sellForm.price} onChange={(e) => setSellForm({...sellForm, price: e.target.value})} /></div>
                          <button onClick={handleSellSubmit} className="w-full py-3 bg-white text-black font-bold uppercase rounded hover:bg-gray-200 transition-colors mt-4">List on WhatsApp</button>
                      </div>
                  ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                          <div className="bg-yellow-400/10 border border-yellow-400/30 p-3 rounded-lg flex items-start gap-3 mb-2">
                              <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-yellow-200">Get instant cash (10-30% of value) directly to your wallet via coupon code. Invoice proof required.</p>
                          </div>
                          
                          <div className="space-y-2"><label className="text-xs text-gray-500 uppercase">Game Name</label><input type="text" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-yellow-400 outline-none" placeholder="e.g. God of War Ragnarok" value={sellForm.gameName} onChange={(e) => setSellForm({...sellForm, gameName: e.target.value})} /></div>
                          <div className="space-y-2"><label className="text-xs text-gray-500 uppercase">Original Purchase Value (₹)</label><input type="number" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-yellow-400 outline-none" placeholder="e.g. 5000" value={sellForm.originalValue} onChange={(e) => setSellForm({...sellForm, originalValue: e.target.value})} /></div>
                          
                          {sellForm.originalValue && (
                              <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
                                  <span className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Estimated Instant Offer</span>
                                  <span className="text-xl font-bold text-yellow-400">₹{Math.floor(Number(sellForm.originalValue) * 0.1)} - ₹{Math.floor(Number(sellForm.originalValue) * 0.3)}</span>
                              </div>
                          )}

                          <div className="space-y-2">
                              <label className="text-xs text-gray-500 uppercase">Upload Invoice Proof</label>
                              <div className="relative w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors bg-black overflow-hidden group">
                                  <input type="file" accept="image/*" onChange={handleInvoiceUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                  {sellForm.invoice ? (
                                      <img src={sellForm.invoice} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" />
                                  ) : (
                                      <>
                                          <Upload className="w-6 h-6 text-gray-400 mb-2"/>
                                          <span className="text-xs text-gray-500">Tap to Upload Image</span>
                                      </>
                                  )}
                                  {sellForm.invoice && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><CheckCircle2 className="w-8 h-8 text-green-500 drop-shadow-md"/></div>}
                              </div>
                          </div>

                          <button onClick={handleSellSubmit} className="w-full py-3 bg-yellow-400 text-black font-bold uppercase rounded hover:bg-yellow-300 transition-colors mt-2 shadow-[0_0_15px_rgba(250,204,21,0.3)]">Accept & Verify on WhatsApp</button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* 9. DAILY LOOT MODAL */}
      {isLootOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-black border border-white/10 rounded-2xl p-8 text-center relative overflow-hidden">
                  <button onClick={() => setIsLootOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <div className="absolute top-0 left-0 right-0 h-32 bg-brahma-cyan/10 blur-3xl rounded-full"></div>
                  <Gift className={`w-20 h-20 mx-auto mb-6 ${lootClaimed ? 'text-gray-600' : 'text-brahma-neon animate-bounce'}`} />
                  <h2 className="text-2xl font-bold text-white font-display uppercase mb-2">Daily Loot Box</h2>
                  
                  {!lootClaimed ? (
                      <>
                        <p className="text-gray-400 text-sm mb-8 font-tech">Open your daily crate for a chance to win exclusive discounts or free games!</p>
                        <button onClick={handleClaimLoot} className="w-full py-4 bg-gradient-to-r from-brahma-neon to-purple-600 text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(217,70,239,0.4)]">Claim Loot</button>
                      </>
                  ) : (
                      <div className="animate-in zoom-in duration-300">
                          <p className="text-gray-400 text-sm mb-4">You opened today's loot:</p>
                          <div className="bg-white/10 border border-white/20 p-4 rounded-xl mb-6">
                              <span className="text-xl font-bold text-brahma-cyan block">{lootReward}</span>
                              {couponInput && <span className="text-xs text-gray-500 mt-1 block">Code Applied: {couponInput}</span>}
                          </div>
                          <p className="text-xs text-gray-500 font-tech">Come back tomorrow for more!</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* 10. STEAM SYNC MODAL (Replaced Cloud Sync) */}
      {isSteamSyncOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="w-full max-w-lg bg-[#111] border border-white/20 rounded-xl p-6 relative">
                  <button onClick={() => setIsSteamSyncOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                  <h3 className="text-xl font-bold text-white mb-4 uppercase flex items-center gap-2"><img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-6 h-6 opacity-80" /> Steam Sync</h3>
                  
                  <div className="space-y-4">
                      <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg flex gap-3 items-start">
                          <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-300">Enter a Steam Store Link or Game Name. AI will fetch real images & apply <span className="text-brahma-cyan font-bold">40-50% Brahmastra Discount</span> automatically.</p>
                      </div>

                      <div className="relative">
                          <input type="text" placeholder="e.g. https://store.steampowered.com/app/1245620/ELDEN_RING/" className="w-full bg-black border border-white/20 p-3 pl-10 rounded text-white text-sm focus:border-blue-500 outline-none transition-colors" value={steamInput} onChange={(e) => setSteamInput(e.target.value)} />
                          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
                      </div>

                      <button onClick={handleSteamSync} disabled={isSyncing} className="w-full py-3 bg-[#171a21] text-white font-bold uppercase rounded hover:bg-[#2a475e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-white/10">
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <DownloadCloud className="w-4 h-4"/>} 
                          {isSyncing ? 'Fetching from Steam...' : 'Fetch & Add to Store'}
                      </button>
                      
                      {syncStatus && <p className="text-center text-xs text-brahma-cyan mt-2 animate-pulse">{syncStatus}</p>}
                  </div>
              </div>
          </div>
      )}

      {/* 11. ADMIN LOGIN MODAL */}
      {isAdminLoginOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
               <div className="w-full max-w-xs bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                   <Lock className="w-12 h-12 text-red-500 mx-auto mb-6" />
                   <h2 className="text-2xl font-bold text-white font-display uppercase mb-6 tracking-widest">Restricted Area</h2>
                   <input type="password" placeholder="ENTER PIN" className="w-full bg-black border border-white/10 text-center text-2xl tracking-[0.5em] text-white p-4 rounded-xl focus:border-red-500 outline-none mb-6 font-display" maxLength={4} value={adminPinInput} onChange={(e) => setAdminPinInput(e.target.value)} />
                   <div className="flex gap-4">
                       <button onClick={() => setIsAdminLoginOpen(false)} className="flex-1 py-3 border border-white/20 rounded-xl text-white hover:bg-white/10">CANCEL</button>
                       <button onClick={handleAdminLogin} className="flex-1 py-3 bg-red-600 rounded-xl text-white font-bold hover:bg-red-500">ACCESS</button>
                   </div>
               </div>
          </div>
      )}

      {/* 12. ADDRESS MODAL (REFACTORED TO DIGITAL DELIVERY) */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#111] border border-white/20 rounded-2xl p-6 relative animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white font-display uppercase flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Quick Checkout</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Instant Digital Delivery</p>
                    </div>
                    <button onClick={() => setIsAddressModalOpen(false)}><X className="w-5 h-5 text-gray-500 hover:text-white"/></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-brahma-cyan/10 border border-brahma-cyan/30 p-3 rounded-lg flex gap-3 items-start">
                        <Smartphone className="w-5 h-5 text-brahma-cyan shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-300">We don't need your address! Game keys are sent instantly to your <strong>WhatsApp</strong> after payment.</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Full Name</label>
                        <input name="name" placeholder="e.g. Naman Sejpal" value={shippingDetails.name} onChange={handleAddressChange} className={`w-full bg-black border ${shippingErrors.name ? 'border-red-500' : 'border-white/20'} p-4 rounded-xl text-white outline-none focus:border-brahma-cyan transition-colors`} />
                        {shippingErrors.name && <p className="text-red-500 text-[10px] ml-1">{shippingErrors.name}</p>}
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">WhatsApp Number</label>
                        <div className="relative">
                            <span className="absolute left-4 top-4 text-gray-500">+91</span>
                            <input type="tel" name="phone" placeholder="98765 43210" value={shippingDetails.phone} onChange={handleAddressChange} className={`w-full bg-black border ${shippingErrors.phone ? 'border-red-500' : 'border-white/20'} p-4 pl-12 rounded-xl text-white outline-none focus:border-brahma-cyan transition-colors font-mono`} maxLength={10} />
                        </div>
                        {shippingErrors.phone && <p className="text-red-500 text-[10px] ml-1">{shippingErrors.phone}</p>}
                    </div>

                    <button onClick={handleAddressSubmit} className="w-full py-4 bg-white text-black font-bold uppercase rounded-xl hover:bg-brahma-cyan transition-colors mt-4 shadow-lg shadow-white/10 flex items-center justify-center gap-2">
                        Proceed to Pay <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 13. PAYMENT MODAL (UPDATED WITH UPI DIRECT) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#111] border border-white/20 rounded-2xl p-6 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                <h3 className="text-xl font-bold text-white font-display uppercase mb-6">Payment Method</h3>
                
                <div className="bg-white/5 p-4 rounded-lg mb-4 space-y-2">
                    <div className="flex justify-between text-sm text-gray-400"><span>Final Amount</span><span>₹{finalTotal}</span></div>
                </div>

                {/* WALLET TOGGLE */}
                <div className="flex items-center justify-between p-4 bg-black border border-white/10 rounded-xl mb-6">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5 text-brahma-cyan" />
                        <div>
                            <p className="text-sm font-bold text-white">Use Wallet Balance</p>
                            <p className="text-[10px] text-gray-500">Available: ₹{walletBalance} (Max use: 10%)</p>
                        </div>
                    </div>
                    <button onClick={() => setUseWallet(!useWallet)} className={`w-12 h-6 rounded-full relative transition-colors ${useWallet ? 'bg-brahma-cyan' : 'bg-gray-700'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useWallet ? 'left-7' : 'left-1'}`}></span>
                    </button>
                </div>

                <div className="space-y-3 mb-8">
                    <div onClick={() => setSelectedPaymentMethod('upi')} className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between ${selectedPaymentMethod === 'upi' ? 'bg-brahma-cyan/10 border-brahma-cyan' : 'bg-black border-white/10'}`}>
                        <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-yellow-400"/><span className="font-bold text-white">UPI / QR Code</span></div>
                        {selectedPaymentMethod === 'upi' && <div className="w-4 h-4 bg-brahma-cyan rounded-full"></div>}
                    </div>
                    <div onClick={() => setSelectedPaymentMethod('card')} className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between ${selectedPaymentMethod === 'card' ? 'bg-brahma-cyan/10 border-brahma-cyan' : 'bg-black border-white/10'}`}>
                        <div className="flex items-center gap-3"><CreditCard className="w-5 h-5 text-gray-400"/><span className="font-bold text-white">Card / NetBanking</span></div>
                        {selectedPaymentMethod === 'card' && <div className="w-4 h-4 bg-brahma-cyan rounded-full"></div>}
                    </div>
                </div>

                {selectedPaymentMethod === 'upi' ? (
                     <div className="text-center space-y-4">
                         <div className="bg-white p-2 w-48 h-48 mx-auto rounded-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiDeepLink)}`} className="w-full h-full max-w-full" alt="QR"/></div>
                         <p className="text-sm text-gray-400">Scan via GPay, PhonePe, Paytm</p>
                         
                         {/* UPI DIRECT BUTTON */}
                         <a href={upiDeepLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-brahma-cyan text-black font-bold uppercase rounded-lg hover:bg-white transition-colors mb-2 animate-pulse">
                            <Smartphone className="w-5 h-5" /> Pay Using UPI Direct
                         </a>

                         <button onClick={handleConfirmPayment} className="w-full py-4 bg-green-500 text-white font-bold uppercase rounded-lg hover:bg-green-600 transition-colors">I Have Paid</button>
                     </div>
                ) : (
                    <button onClick={handleConfirmPayment} className="w-full py-4 bg-white text-black font-bold uppercase rounded-lg hover:bg-brahma-cyan transition-colors">Pay Securely</button>
                )}
            </div>
        </div>
      )}

      {/* 14. PROCESSING MODAL */}
      {isProcessingPayment && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="text-center">
                <Loader2 className="w-16 h-16 text-brahma-cyan animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white font-display animate-pulse tracking-widest">VERIFYING PAYMENT...</h2>
                <p className="text-gray-400 font-tech mt-2 text-sm uppercase tracking-wider">Please wait, contacting bank server.</p>
                <div className="w-64 h-1 bg-gray-800 rounded-full mx-auto mt-6 overflow-hidden">
                    <div className="h-full bg-brahma-cyan animate-[marquee_2s_linear_infinite]"></div>
                </div>
                <p className="text-xs text-red-500 mt-8">Do not close this window.</p>
            </div>
        </div>
      )}

      {/* 15. SUCCESS MODAL (UPDATED WITH ACCESS CODE) */}
      {isPaymentSuccess && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="w-full max-w-sm bg-[#111] border border-green-500/30 rounded-3xl p-8 text-center relative overflow-hidden animate-in zoom-in duration-500">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent"></div>
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
                <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase">Payment Success!</h2>
                
                {generatedAccessCode && (
                    <div className="my-6 bg-white/5 border border-brahma-cyan/30 rounded-xl p-4">
                        <p className="text-[10px] text-brahma-cyan uppercase tracking-widest mb-1">Your Access Code</p>
                        <p className="text-2xl font-mono font-bold text-white tracking-widest select-all break-all">{generatedAccessCode}</p>
                    </div>
                )}
                
                <div className="space-y-3">
                    <button onClick={() => handleAccessCodeWhatsApp(generatedAccessCode || '')} className="w-full py-4 bg-[#25D366] text-white font-bold uppercase rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,211,102,0.4)] animate-bounce"><MessageCircle className="w-5 h-5"/> Claim Game on WhatsApp</button>
                    <button onClick={() => { setIsPaymentSuccess(false); setLastOrderDetails(null); }} className="w-full py-3 border border-white/20 text-white font-bold uppercase rounded-xl hover:bg-white/10">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* 16. LIVE NOTIFICATION TOAST */}
      {liveNotification && (
          <div className="fixed bottom-6 left-6 z-[60] bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-4 shadow-2xl max-w-xs animate-in slide-in-from-left fade-in duration-500">
              <img src={liveNotification.img} className="w-10 h-12 object-cover rounded" onError={(e) => e.currentTarget.src = DEFAULT_GAME_IMAGE} />
              <div>
                  <p className="text-white text-xs font-bold leading-tight">{liveNotification.text}</p>
                  <p className="text-brahma-cyan text-[10px] font-tech uppercase">{liveNotification.sub}</p>
              </div>
          </div>
      )}

      {/* --- ADMIN PANEL (RESPONSIVE) --- */}
      {isAdminAuthenticated && (
          <div className="fixed inset-0 z-[190] flex flex-col md:flex-row bg-black/95 backdrop-blur-xl overflow-hidden">
             {/* Admin Sidebar */}
             <div className={`${adminSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-20 h-full w-64 border-r border-white/10 bg-[#0a0a0a] flex flex-col transition-transform duration-300`}>
                 <div className="p-6 border-b border-white/10 flex justify-between items-center">
                     <div>
                        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2"><Lock className="w-5 h-5 text-brahma-cyan"/> ADMIN OS</h2>
                        <p className="text-[10px] text-gray-500 font-tech mt-1 uppercase tracking-widest">v2.5.0 • Superuser</p>
                     </div>
                     <button onClick={() => setAdminSidebarOpen(false)} className="md:hidden text-white"><X className="w-5 h-5"/></button>
                 </div>
                 <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                     <button onClick={() => { setAdminTab('dashboard'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'dashboard' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><LayoutDashboard className="w-4 h-4" /> Dashboard</button>
                     <button onClick={() => { setAdminTab('marketing'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'marketing' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><Tag className="w-4 h-4" /> Marketing & Wallet</button>
                     <button onClick={() => { setAdminTab('catalog'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'catalog' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><Grid className="w-4 h-4" /> Catalog Manager</button>
                     <button onClick={() => { setAdminTab('upcoming'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'upcoming' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><CalendarDays className="w-4 h-4" /> Upcoming Games</button>
                     <button onClick={() => { setAdminTab('ai'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'ai' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><Bot className="w-4 h-4" /> AI Operations</button>
                     <button onClick={() => { setAdminTab('settings'); setAdminSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold font-tech uppercase tracking-wide transition-all ${adminTab === 'settings' ? 'bg-brahma-cyan/10 text-brahma-cyan border border-brahma-cyan/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><Settings className="w-4 h-4" /> Store Settings</button>
                 </nav>
                 <div className="p-4 border-t border-white/10">
                     <button onClick={() => setIsAdminAuthenticated(false)} className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors font-bold uppercase text-xs tracking-wider"><LogOut className="w-4 h-4" /> Logout</button>
                 </div>
             </div>
             
             {/* Mobile Sidebar Backdrop */}
             {adminSidebarOpen && <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={() => setAdminSidebarOpen(false)}></div>}

             {/* Admin Content Area */}
             <div className="flex-1 overflow-y-auto bg-[#050505]">
                 {/* Mobile Header */}
                 <div className="md:hidden p-4 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
                     <h2 className="text-lg font-display font-bold text-white">ADMIN DASHBOARD</h2>
                     <button onClick={() => setAdminSidebarOpen(true)} className="text-white"><Menu className="w-6 h-6"/></button>
                 </div>

                 <div className="p-4 md:p-8 max-w-6xl mx-auto">
                     {adminTab === 'dashboard' && (
                         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                             <h2 className="text-3xl font-display font-bold text-white uppercase hidden md:block">Analytics</h2>
                             <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                                 <div className="flex justify-between items-center mb-6">
                                     <h3 className="font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Sales Comparison</h3>
                                     <div className="flex gap-4 text-xs font-bold"><span className="text-brahma-cyan">● Today</span><span className="text-gray-600">● Yesterday</span></div>
                                 </div>
                                 <div className="flex items-end justify-between gap-2 md:gap-4 h-64 px-2 md:px-4 border-b border-white/10 pb-4">
                                     {[60, 45, 80, 50, 90, 70, 100].map((h, i) => (
                                         <div key={i} className="flex-1 flex gap-1 h-full items-end">
                                             <div className="w-full bg-gray-800 rounded-t" style={{height: `${h * 0.7}%`}}></div>
                                             <div className="w-full bg-brahma-cyan rounded-t" style={{height: `${h}%`}}></div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     )}
                     
                     {/* ... (Other Admin Tabs remain unchanged) ... */}
                     
                     {adminTab === 'settings' && (
                         <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                             <h2 className="text-3xl font-display font-bold text-white uppercase">Store Settings</h2>
                             <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4">
                                 <div className="flex items-center justify-between">
                                     <div>
                                         <h4 className="font-bold text-white">Maintenance Mode</h4>
                                         <p className="text-xs text-gray-500">Close store for customers temporarily.</p>
                                     </div>
                                     <button onClick={() => setStoreSettings({...storeSettings, maintenanceMode: !storeSettings.maintenanceMode})} className={`w-12 h-6 rounded-full relative transition-colors ${storeSettings.maintenanceMode ? 'bg-red-500' : 'bg-gray-700'}`}>
                                         <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${storeSettings.maintenanceMode ? 'left-7' : 'left-1'}`}></span>
                                     </button>
                                 </div>
                                 
                                 {/* FLASH SALE BANNER SETTINGS */}
                                 <div className="border-t border-white/5 pt-4">
                                     <div className="flex items-center justify-between mb-4">
                                         <div>
                                             <h4 className="font-bold text-white">Flash Sale Banner</h4>
                                             <p className="text-xs text-gray-500">Show the scrolling yellow banner on top.</p>
                                         </div>
                                         <button onClick={() => setStoreSettings({...storeSettings, flashSaleEnabled: !storeSettings.flashSaleEnabled})} className={`w-12 h-6 rounded-full relative transition-colors ${storeSettings.flashSaleEnabled ? 'bg-green-500' : 'bg-gray-700'}`}>
                                             <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${storeSettings.flashSaleEnabled ? 'left-7' : 'left-1'}`}></span>
                                         </button>
                                     </div>
                                     
                                     {storeSettings.flashSaleEnabled && (
                                         <div className="space-y-3 bg-black/40 p-4 rounded-lg border border-white/5">
                                             <div>
                                                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Banner Text</label>
                                                 <input type="text" value={storeSettings.bannerText} onChange={(e) => setStoreSettings({...storeSettings, bannerText: e.target.value})} className="w-full bg-[#050505] border border-white/10 rounded p-2 text-white text-sm focus:border-yellow-400 outline-none" placeholder="Enter scrolling text..." />
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Click Link (Optional)</label>
                                                 <input type="text" value={storeSettings.bannerLink || ''} onChange={(e) => setStoreSettings({...storeSettings, bannerLink: e.target.value})} className="w-full bg-[#050505] border border-white/10 rounded p-2 text-white text-sm focus:border-yellow-400 outline-none" placeholder="https://..." />
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )}
                 </div>
             </div>
          </div>
      )}

      {/* NEW FOOTER SECTION */}
      <footer className="bg-[#050505] border-t border-white/10 pt-12 pb-8 px-4 mt-20">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div className="space-y-4">
                  <div className="flex items-center gap-2">
                      <img src="logo.png" className="w-8 h-8 opacity-80" onError={(e) => e.currentTarget.style.display='none'} />
                      <h2 className="font-display font-bold text-xl text-white tracking-widest">BRAHMASTRA</h2>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed font-tech">
                      India's premium digital game store. We provide instant access to the world's best AAA titles at unbeatable prices.
                  </p>
                  <div className="flex gap-4">
                      <a href="#" className="text-gray-400 hover:text-white transition-colors"><Instagram className="w-5 h-5"/></a>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors"><Youtube className="w-5 h-5"/></a>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter className="w-5 h-5"/></a>
                  </div>
              </div>
              
              <div>
                  <h3 className="font-bold text-white uppercase mb-4 tracking-wider">Shop</h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">New Releases</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">Best Sellers</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">PS5 Games</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">Steam Keys</a></li>
                  </ul>
              </div>

              <div>
                  <h3 className="font-bold text-white uppercase mb-4 tracking-wider">Support</h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">Track Order</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">Contact Us</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">FAQ</a></li>
                      <li><a href="#" className="hover:text-brahma-cyan transition-colors">Terms of Service</a></li>
                  </ul>
              </div>

              <div>
                  <h3 className="font-bold text-white uppercase mb-4 tracking-wider">Verified & Secure</h3>
                  <div className="flex items-center gap-2 mb-4 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                      <ShieldCheck className="w-5 h-5"/>
                      <span className="text-xs font-bold uppercase">100% Safe Payments</span>
                  </div>
                  <div className="flex gap-2">
                      <div className="h-8 w-12 bg-white rounded flex items-center justify-center"><img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" className="h-4" /></div>
                      <div className="h-8 w-12 bg-white rounded flex items-center justify-center"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3" /></div>
                      <div className="h-8 w-12 bg-white rounded flex items-center justify-center"><img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-4" /></div>
                  </div>
              </div>
          </div>
          <div className="text-center border-t border-white/5 pt-8">
              <p className="text-xs text-gray-600 uppercase tracking-widest">© 2024 Brahmastra Game Store. Developed by Naman Sejpal.</p>
          </div>
      </footer>

    </div>
  );
};
