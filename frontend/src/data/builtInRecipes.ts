import { UploadResult } from '../context/UploadedDataContext';

export interface RecipeIngredient {
  name: string;
  cost: number;
}

export interface ItemRecipe {
  name: string;
  category: string;
  size: string;
  cheese: string;
  ingredients: RecipeIngredient[];
  making: number;
  sale: number;
  profit: number;
  rmPct: number;
  marginPct: number;
  cls: 'High Margin' | 'Medium Margin' | 'Low Margin';
  isCombo?: boolean;
  source?: 'builtin' | 'excel';
}

function classifyMargin(marginPct: number): 'High Margin' | 'Medium Margin' | 'Low Margin' {
  if (marginPct >= 48) return 'High Margin';
  if (marginPct <= 35) return 'Low Margin';
  return 'Medium Margin';
}

export const BUILT_IN_RECIPES: ItemRecipe[] = [
  // ── Beverages ──
  {
    name: 'COLD COFFEE 25', category: 'Beverages', size: 'Small (250ml)', cheese: 'No Cheese',
    ingredients: [
      { name: 'POUCH', cost: 45 }, { name: 'COFFEE', cost: 15 },
      { name: 'GLASS', cost: 1.5 }, { name: 'STREW', cost: 0.3 },
    ],
    making: 16.8, sale: 25, profit: 8.2, rmPct: 67.2, marginPct: 32.8, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'COLD COFFEE 30', category: 'Beverages', size: 'Medium (300ml)', cheese: 'No Cheese',
    ingredients: [
      { name: 'POUCH', cost: 45 }, { name: 'COFFEE', cost: 15 },
      { name: 'GLASS', cost: 5 }, { name: 'STREW', cost: 0.3 },
    ],
    making: 20.3, sale: 30, profit: 9.7, rmPct: 67.67, marginPct: 32.33, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'COLD COFFEE 35', category: 'Beverages', size: 'Large (350ml)', cheese: 'No Cheese',
    ingredients: [
      { name: 'POUCH', cost: 45 }, { name: 'COFFEE', cost: 20.45 },
      { name: 'GLASS', cost: 5 }, { name: 'STREW', cost: 0.3 },
    ],
    making: 25.75, sale: 35, profit: 9.25, rmPct: 73.58, marginPct: 26.42, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'CHOCOLATE 29', category: 'Beverages', size: 'Regular (250ml)', cheese: 'No Cheese',
    ingredients: [
      { name: 'POUCH', cost: 45 }, { name: 'CHOCOLATE', cost: 15 },
      { name: 'GLASS', cost: 1.5 }, { name: 'STREW', cost: 0.3 },
    ],
    making: 16.8, sale: 29, profit: 12.2, rmPct: 57.93, marginPct: 42.07, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'CHOCOLATE 45', category: 'Beverages', size: 'Bigger (350ml)', cheese: 'No Cheese',
    ingredients: [
      { name: 'POUCH', cost: 45 }, { name: 'CHOCOLATE', cost: 20.45 },
      { name: 'GLASS', cost: 5 }, { name: 'STREW', cost: 0.3 },
    ],
    making: 25.75, sale: 45, profit: 19.25, rmPct: 57.23, marginPct: 42.77, cls: 'Medium Margin', source: 'builtin',
  },

  // ── Burgers (Regular) ──
  {
    name: 'SIMPLY VEG 30', category: 'Burgers', size: 'Standard 30', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 1.5 },
      { name: 'DISH', cost: 0.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 18.3, sale: 30, profit: 11.7, rmPct: 61, marginPct: 39, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'TANGY 30', category: 'Burgers', size: 'Standard 30', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2 },
      { name: 'DISH', cost: 0.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 18.8, sale: 30, profit: 11.2, rmPct: 62.67, marginPct: 37.33, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'CHATPATA 30', category: 'Burgers', size: 'Standard 30', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2 },
      { name: 'DISH', cost: 0.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 18.8, sale: 30, profit: 11.2, rmPct: 62.67, marginPct: 37.33, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'TANDOORI 40', category: 'Burgers', size: 'Premium 40', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2.4 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 22.6, sale: 40, profit: 17.4, rmPct: 56.5, marginPct: 43.5, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'PERI PERI 40', category: 'Burgers', size: 'Premium 40', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2.4 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 22.6, sale: 40, profit: 17.4, rmPct: 56.5, marginPct: 43.5, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'SCHEZWAN 50', category: 'Burgers', size: 'Deluxe 50', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 1.5 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'SCHZWAN', cost: 8 },
    ],
    making: 29.7, sale: 50, profit: 20.3, rmPct: 59.4, marginPct: 40.6, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'GREEN TWISTER 50', category: 'Burgers', size: 'Deluxe 50', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 1.5 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHUTNEY', cost: 3 },
    ],
    making: 24.7, sale: 50, profit: 25.3, rmPct: 49.4, marginPct: 50.6, cls: 'High Margin', source: 'builtin',
  },

  // ── Burgers (Cheesy) ──
  {
    name: 'TANGY CHEEZY 40', category: 'Burgers', size: 'Cheesy 40', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 1 },
      { name: 'ONION & TOMATO', cost: 0.5 }, { name: 'MAYO', cost: 2 },
      { name: 'DISH & WAFFERS', cost: 1.5 }, { name: 'KETCHUP', cost: 0.6 }, { name: 'CHEEZ', cost: 2 },
    ],
    making: 19.6, sale: 40, profit: 20.4, rmPct: 49, marginPct: 51, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'CHATPATA CHEEZY 40', category: 'Burgers', size: 'Cheesy 40', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHEEZ', cost: 2.69 },
    ],
    making: 24.89, sale: 40, profit: 15.11, rmPct: 62.22, marginPct: 37.78, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'TANDOORI CHEEZY 50', category: 'Burgers', size: 'Cheesy 50', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2.4 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHEEZ', cost: 2.69 },
    ],
    making: 25.29, sale: 50, profit: 24.71, rmPct: 50.58, marginPct: 49.42, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'PERI CHEEZY 50', category: 'Burgers', size: 'Cheesy 50', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO', cost: 2.4 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHEEZ', cost: 2.69 },
    ],
    making: 25.29, sale: 50, profit: 24.71, rmPct: 50.58, marginPct: 49.42, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'SCHEZWAN CHEEZY 60', category: 'Burgers', size: 'Cheesy 60', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO & SCHZWAN', cost: 9.5 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHEEZ', cost: 2.69 },
    ],
    making: 32.39, sale: 60, profit: 27.61, rmPct: 53.98, marginPct: 46.02, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'GREEN CHEEZY 60', category: 'Burgers', size: 'Cheesy 60', cheese: 'With Cheese (Blend)',
    ingredients: [
      { name: 'BREAD', cost: 6 }, { name: 'TIKKI', cost: 6 }, { name: 'OIL', cost: 2 },
      { name: 'ONION & TOMATO', cost: 1 }, { name: 'MAYO & SCHZWAN', cost: 4.5 },
      { name: 'DISH & WAFFERS', cost: 4.2 }, { name: 'KETCHUP', cost: 1 }, { name: 'CHEEZ', cost: 2.69 },
    ],
    making: 27.39, sale: 60, profit: 32.61, rmPct: 45.65, marginPct: 54.35, cls: 'High Margin', source: 'builtin',
  },

  // ── Pizzas ──
  {
    name: 'VEG PIZZA 50', category: 'Pizzas', size: 'Standard 50', cheese: 'With Mozzarella',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'PUREE', cost: 1.7 }, { name: 'VEGETABLE', cost: 2 },
      { name: 'CHEEZ', cost: 2.69 }, { name: 'MOZZARELLA', cost: 11.76 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 27.95, sale: 50, profit: 22.05, rmPct: 55.9, marginPct: 44.1, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'MARGHERITA PIZZA 50', category: 'Pizzas', size: 'Standard 50', cheese: 'With Mozzarella',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'PUREE', cost: 1.7 }, { name: 'VEGETABLE', cost: 0 },
      { name: 'CHEEZ', cost: 2.69 }, { name: 'MOZZARELLA', cost: 11.76 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 25.95, sale: 50, profit: 24.05, rmPct: 51.9, marginPct: 48.1, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'SCHEZWAN PIZZA 80', category: 'Pizzas', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'SCHEZWAN', cost: 10 }, { name: 'VEGETABLE', cost: 2 },
      { name: 'CHEEZ', cost: 2.69 }, { name: 'MOZZARELLA', cost: 11.76 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 36.25, sale: 80, profit: 43.75, rmPct: 45.31, marginPct: 54.69, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'GREEN PIZZA 80', category: 'Pizzas', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'CHUTNEY', cost: 3.75 }, { name: 'VEGETABLE', cost: 2 },
      { name: 'CHEEZ', cost: 2.69 }, { name: 'MOZZARELLA', cost: 11.76 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 30, sale: 80, profit: 50, rmPct: 37.5, marginPct: 62.5, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'TANDOORI PIZZA 100', category: 'Pizzas', size: 'Premium 100', cheese: 'With Mozzarella + Paneer',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'MAYO', cost: 2.4 }, { name: 'PANNER', cost: 9.2 },
      { name: 'CHEEZ', cost: 2.69 }, { name: 'MOZZARELLA', cost: 12.6 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 36.69, sale: 100, profit: 63.31, rmPct: 36.69, marginPct: 63.31, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'CORN PIZZA 100', category: 'Pizzas', size: 'Premium 100', cheese: 'With Mozzarella + Corn',
    ingredients: [
      { name: 'BREAD', cost: 7 }, { name: 'CHEEZ (SAUCE)', cost: 2.4 }, { name: 'CORN', cost: 1.8 },
      { name: 'CHEEZ', cost: 4.48 }, { name: 'MOZZARELLA', cost: 12.6 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 31.08, sale: 100, profit: 68.92, rmPct: 31.08, marginPct: 68.92, cls: 'High Margin', source: 'builtin',
  },

  // ── French Fries ──
  {
    name: 'FRIES 45', category: 'French Fries', size: 'Standard 45', cheese: 'No Cheese',
    ingredients: [
      { name: 'FRIES', cost: 15.6 }, { name: 'OIL', cost: 4 },
      { name: 'DISH', cost: 0.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 21.4, sale: 45, profit: 23.6, rmPct: 47.56, marginPct: 52.44, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'PERI FRIES 55', category: 'French Fries', size: 'Seasoned 55', cheese: 'No Cheese',
    ingredients: [
      { name: 'FRIES', cost: 15.6 }, { name: 'MASALA', cost: 2.56 }, { name: 'OIL', cost: 4 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 24.96, sale: 55, profit: 30.04, rmPct: 45.38, marginPct: 54.62, cls: 'High Margin', source: 'builtin',
  },
  {
    name: 'FRIES 2 DIP 70', category: 'French Fries', size: 'With Dips 70', cheese: 'Dips Included',
    ingredients: [
      { name: 'FRIES', cost: 13 }, { name: 'DIP', cost: 2.2 }, { name: 'OIL', cost: 4 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 22, sale: 70, profit: 48, rmPct: 31.43, marginPct: 68.57, cls: 'High Margin', source: 'builtin',
  },

  // ── Sandwiches ──
  {
    name: 'CHEESE MAYO SANDWICH 65', category: 'Sandwiches', size: 'Cheesy 65', cheese: 'With Cheese',
    ingredients: [
      { name: 'BREAD', cost: 12 }, { name: 'BUTTER', cost: 10.08 }, { name: 'GREEN CHUTNEY', cost: 4.5 },
      { name: 'MAYO PASTE', cost: 3.25 }, { name: 'SEV & WAFFERS', cost: 4.4 }, { name: 'CHEESE', cost: 17 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 54.03, sale: 65, profit: 10.97, rmPct: 83.12, marginPct: 16.88, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'MAYO SANDWICH 45', category: 'Sandwiches', size: 'Standard 45', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 12 }, { name: 'BUTTER', cost: 10.08 }, { name: 'GREEN CHUTNEY', cost: 4.5 },
      { name: 'MAYO PASTE', cost: 3.25 }, { name: 'SEV & WAFFERS', cost: 4.4 }, { name: 'CHEESE', cost: 0 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 37.03, sale: 45, profit: 7.97, rmPct: 82.29, marginPct: 17.71, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'FLAVOURED MAYO SANDWICH 75', category: 'Sandwiches', size: 'Premium 75', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 12 }, { name: 'BUTTER', cost: 10.08 }, { name: 'FLAVOURED MAYO', cost: 7.2 },
      { name: 'MAYO PASTE', cost: 3.25 }, { name: 'SEV & WAFFERS', cost: 4.4 }, { name: 'CHEESE', cost: 0 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 39.73, sale: 75, profit: 35.27, rmPct: 52.97, marginPct: 47.03, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'BREAD BUTTER SANDWICH 30', category: 'Sandwiches', size: 'Simple 30', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 12 }, { name: 'BUTTER', cost: 10.08 }, { name: 'GREEN CHUTNEY', cost: 0 },
      { name: 'MAYO PASTE', cost: 0 }, { name: 'SEV & WAFFERS', cost: 0 }, { name: 'CHEESE', cost: 0 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 24.88, sale: 30, profit: 5.12, rmPct: 82.93, marginPct: 17.07, cls: 'Low Margin', source: 'builtin',
  },
  {
    name: 'BREAD BUTTER CHUTNEY 35', category: 'Sandwiches', size: 'Simple 35', cheese: 'Without Cheese',
    ingredients: [
      { name: 'BREAD', cost: 12 }, { name: 'BUTTER', cost: 10.08 }, { name: 'GREEN CHUTNEY', cost: 4.5 },
      { name: 'MAYO PASTE', cost: 0 }, { name: 'SEV & WAFFERS', cost: 0 }, { name: 'CHEESE', cost: 0 },
      { name: 'DISH', cost: 1.8 }, { name: 'KETCHUP', cost: 1 },
    ],
    making: 29.38, sale: 35, profit: 5.62, rmPct: 83.94, marginPct: 16.06, cls: 'Low Margin', source: 'builtin',
  },

  // ── Garlic Bread ──
  {
    name: 'PLAIN GARLIC BREAD', category: 'Garlic Bread', size: 'Standard 36', cheese: 'Without Cheese',
    ingredients: [{ name: 'PLAIN GARLIC BASE + BUTTER', cost: 36.25 }],
    making: 36.25, sale: 59, profit: 22.75, rmPct: 61.44, marginPct: 38.56, cls: 'Medium Margin', source: 'builtin',
  },
  {
    name: 'VEG CHEESE GARLIC BREAD', category: 'Garlic Bread', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese',
    ingredients: [{ name: 'CHEESE GARLIC BASE + MOZZARELLA', cost: 36.6 }],
    making: 36.6, sale: 78, profit: 41.4, rmPct: 46.92, marginPct: 53.08, cls: 'High Margin', source: 'builtin',
  },

  // ── Combos ──
  {
    name: 'SCHEZWAN BURGER COMBO 50', category: 'Combos', size: 'Combo 50', cheese: 'Burger + Coffee',
    ingredients: [{ name: 'BURGER', cost: 25.25 }, { name: 'COFFEE', cost: 16.01 }],
    making: 41.26, sale: 50, profit: 8.74, rmPct: 82.52, marginPct: 17.48, cls: 'Low Margin', isCombo: true, source: 'builtin',
  },
  {
    name: 'GREEN BURGER COMBO 50', category: 'Combos', size: 'Combo 50', cheese: 'Burger + Coffee',
    ingredients: [{ name: 'BURGER', cost: 18.75 }, { name: 'COFFEE', cost: 16.01 }],
    making: 34.76, sale: 50, profit: 15.24, rmPct: 69.52, marginPct: 30.48, cls: 'Low Margin', isCombo: true, source: 'builtin',
  },
  {
    name: 'SCHEZWAN PIZZA COMBO 80', category: 'Combos', size: 'Combo 80', cheese: 'Pizza + Coffee',
    ingredients: [{ name: 'PIZZA', cost: 35.2 }, { name: 'COFFEE', cost: 16.01 }],
    making: 51.21, sale: 80, profit: 28.79, rmPct: 64.01, marginPct: 35.99, cls: 'Medium Margin', isCombo: true, source: 'builtin',
  },
  {
    name: 'GREEN PIZZA COMBO 80', category: 'Combos', size: 'Combo 80', cheese: 'Pizza + Coffee',
    ingredients: [{ name: 'PIZZA', cost: 27.07 }, { name: 'COFFEE', cost: 16.01 }],
    making: 43.08, sale: 80, profit: 36.92, rmPct: 53.85, marginPct: 46.15, cls: 'Medium Margin', isCombo: true, source: 'builtin',
  },
];

function normalizeRecipeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/marghrita/g, 'margherita')
    .replace(/bred/g, 'bread')
    .replace(/chuntey/g, 'chutney')
    .replace(/schzwan|sezwan/g, 'schezwan')
    .replace(/tandori/g, 'tandoori')
    .replace(/cheez(?!y)/g, 'cheese')
    .replace(/[^a-z0-9]/g, '');
}

function guessCategory(name: string, isCombo: boolean): string {
  if (isCombo) return 'Combos';
  const low = name.toLowerCase();
  if (low.includes('coffee') || low.includes('chocolate')) return 'Beverages';
  if (low.includes('pizza')) return 'Pizzas';
  if (low.includes('sandwich')) return 'Sandwiches';
  if (low.includes('fries')) return 'French Fries';
  if (low.includes('garlic')) return 'Garlic Bread';
  return 'Burgers';
}

/**
 * Parses multi-block recipe costing grids (like the uploaded CSV/Excel where
 * item blocks are arranged across columns with MAKING / SALE / PROFIT / R.M % / MARGIN % rows).
 */
export function parseRecipesFromDatasets(datasets: UploadResult[]): ItemRecipe[] {
  const extracted: ItemRecipe[] = [];

  for (const ds of datasets) {
    for (const sheet of ds.raw_sheets || []) {
      const grid: string[][] = [];
      if (sheet.headers && sheet.headers.length > 0) grid.push(sheet.headers);
      for (const r of sheet.rows || []) grid.push(r);
      if (grid.length === 0) continue;

      const maxCols = Math.max(...grid.map((r) => r.length));

      // Scan every pair of columns (c, c+1) for recipe blocks
      for (let c = 0; c < maxCols - 1; c++) {
        let r = 0;
        while (r < grid.length) {
          const label = String(grid[r]?.[c] ?? '').trim();
          const valRaw = String(grid[r]?.[c + 1] ?? '').trim();

          // A recipe block header has text in col c, empty in col c+1, and is followed by ingredient rows + MAKING/SALE
          const isSkipHeader =
            !label ||
            valRaw !== '' ||
            /^(combo|extra|high margin|low margin|making|sale|profit|r\.?m\s*%|margin\s*%)/i.test(label);

          if (!isSkipHeader) {
            const ingredients: RecipeIngredient[] = [];
            let making = 0;
            let sale = 0;
            let profit = 0;
            let rmPct = 0;
            let marginPct = 0;
            let foundSummary = false;
            let k = r + 1;

            while (k < grid.length) {
              const ingName = String(grid[k]?.[c] ?? '').trim();
              const ingValStr = String(grid[k]?.[c + 1] ?? '').trim();
              if (!ingName) break;

              const num = parseFloat(ingValStr.replace(/[₹$,%]/g, ''));
              const upper = ingName.toUpperCase();

              if (upper === 'MAKING' && !isNaN(num)) {
                making = num;
                foundSummary = true;
              } else if (upper === 'SALE' && !isNaN(num)) {
                sale = num;
                foundSummary = true;
              } else if (upper === 'PROFIT' && !isNaN(num)) {
                profit = num;
                foundSummary = true;
              } else if (/^R\.?M\s*%$/i.test(ingName) && !isNaN(num)) {
                rmPct = num;
                foundSummary = true;
              } else if (/^MARGIN\s*%$/i.test(ingName) && !isNaN(num)) {
                marginPct = num;
                foundSummary = true;
                k++;
                break;
              } else if (ingValStr === '' && foundSummary) {
                break;
              } else if (!isNaN(num)) {
                ingredients.push({ name: ingName, cost: num });
              }
              k++;
            }

            if (foundSummary && ingredients.length > 0 && making > 0) {
              const isCombo =
                ingredients.some((i) => /^(burger|pizza)$/i.test(i.name)) &&
                ingredients.some((i) => /^coffee$/i.test(i.name));
              const calcMargin = marginPct || (sale > 0 ? ((sale - making) / sale) * 100 : 0);
              const calcRm = rmPct || (sale > 0 ? (making / sale) * 100 : 0);
              const calcProfit = profit || (sale > 0 ? sale - making : 0);

              extracted.push({
                name: isCombo && !label.toLowerCase().includes('combo') ? `${label} COMBO` : label,
                category: guessCategory(label, isCombo),
                size: sale > 0 ? `₹${sale}` : 'Standard',
                cheese: ingredients.some((i) => /cheez|cheese|mozzarella/i.test(i.name))
                  ? 'With Cheese'
                  : 'Standard',
                ingredients,
                making: Math.round(making * 100) / 100,
                sale: Math.round(sale * 100) / 100,
                profit: Math.round(calcProfit * 100) / 100,
                rmPct: Math.round(calcRm * 100) / 100,
                marginPct: Math.round(calcMargin * 100) / 100,
                cls: classifyMargin(calcMargin),
                isCombo,
                source: 'excel',
              });
              r = k;
              continue;
            }
          }
          r++;
        }
      }
    }
  }

  return extracted;
}

export function findRecipeForItem(itemName: string, recipes: ItemRecipe[]): ItemRecipe | null {
  const target = normalizeRecipeKey(itemName);
  if (!target) return null;

  // 1. Exact normalized match
  const exact = recipes.find((r) => normalizeRecipeKey(r.name) === target);
  if (exact) return exact;

  // 2. Strip "cold" or common prefixes / substring match (e.g. "Coffee 30" -> "COLD COFFEE 30")
  const partial = recipes.find((r) => {
    const k = normalizeRecipeKey(r.name);
    return k.includes(target) || target.includes(k);
  });
  return partial || null;
}
