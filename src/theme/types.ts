export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderAlt: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  gradientStart: string;
  gradientEnd: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  card: string;
  cardBorder: string;
  scanOverlay: string;
  priceUp: string;
  priceDown: string;
  priceStable: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ThemeShadow {
  color: string;
  offset: { width: number; height: number };
  opacity: number;
  radius: number;
  elevation: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadow: ThemeShadow;
  glowEnabled: boolean;
}

export type ThemeId =
  | 'futuristic-dark'
  | 'futuristic-light'
  | 'anime-neon'
  | 'anime-pastel'
  | 'cyberpunk'
  | 'minimal-clean'
  | 'ninja';
