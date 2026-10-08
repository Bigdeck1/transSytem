import { Dimensions, PixelRatio, Platform } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Guideline base dimensions based on standard mobile phone (iPhone X/11/12 standard 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Responsive scale helpers to ensure UI fits proportionally across
 * all screen sizes (Compact phones, Phablets, Foldables, Tablets).
 */
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

export const moderateScale = (size: number, factor = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

export const isSmallDevice = SCREEN_WIDTH < 375;
export const isTablet = SCREEN_WIDTH >= 600;
export const isLargePhone = SCREEN_WIDTH >= 414;

/**
 * Unified Design Palette
 * Identical hex codes and semantic roles as the Web Application
 */
export const Colors = {
  // Brand Primary & Accents
  primaryNavy: "#0D47A1",      // Deep Navy Brand / Header / Active highlight
  primaryBlue: "#1976D2",      // Vibrant Electric Blue (Buttons, Active tabs, Highlights)
  primaryHover: "#1565C0",     // Hover / Pressed state
  primaryLight: "#3B82F6",     // Light blue
  primarySoft: "#E3F2FD",      // Soft ice blue tint for badges/stat backgrounds
  primaryDark: "#0A3578",

  // Semantic Statuses
  success: "#10B981",          // Emerald Green (Completed, Verified, Compliant)
  successSoft: "#ECFDF5",      // Soft green background
  successBorder: "#A7F3D0",
  successText: "#065F46",

  warning: "#F59E0B",          // Amber (Pending, In Transit, Caution)
  warningSoft: "#FFFBEB",      // Soft amber background
  warningBorder: "#FDE68A",
  warningText: "#92400E",

  danger: "#EF4444",           // Coral Red (Urgent, Alert, Delayed)
  dangerSoft: "#FEF2F2",       // Soft red background
  dangerBorder: "#FECACA",
  dangerText: "#991B1B",

  info: "#0284C7",             // Sky Blue (Notice, Info)
  infoSoft: "#F0F9FF",
  infoBorder: "#BAE6FD",
  infoText: "#0369A1",

  // Canvas & Surfaces
  background: "#F8FAFC",       // Sleek slate-50 background canvas
  card: "#FFFFFF",             // Pure crisp white card surface
  cardSecondary: "#F1F5F9",    // Slate-100 card
  border: "#E2E8F0",           // Slate-200 card border
  borderSubtle: "#F1F5F9",     // Slate-100 border
  divider: "#E2E8F0",

  // Typography
  textPrimary: "#0F172A",      // Slate-900 (High contrast header & primary text)
  textSecondary: "#475569",    // Slate-600 (Labels, descriptions)
  textMuted: "#94A3B8",        // Slate-400 (Placeholders, timestamps)
  textWhite: "#FFFFFF",

  // Tab & Navigation
  tabBarBg: "#FFFFFF",
  tabBarBorder: "#E2E8F0",
  tabBarActive: "#0D47A1",
  tabBarInactive: "#64748B",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  horizontal: isSmallDevice ? 14 : isTablet ? 28 : 18,
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: "#0D47A1",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#0D47A1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: "#0D47A1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 7,
  },
};

export const theme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  shadows: Shadows,
  scale,
  verticalScale,
  moderateScale,
  isSmallDevice,
  isTablet,
  isLargePhone,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
};

export default theme;
