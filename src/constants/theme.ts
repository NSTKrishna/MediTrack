import { Platform } from 'react-native';

/**
 * Text colours meet WCAG AA (4.5:1) on `background` and `surface`. `warning` and `success` were
 * darkened in the Milestone 10 accessibility pass; `secondary` is decorative only, while
 * `secondaryStrong` is used behind white button text.
 */
export const colors = {
  primary: '#1769AA',
  primaryDark: '#0E4F86',
  primarySoft: '#DBEEF9',
  secondary: '#2F9D79',
  secondaryStrong: '#1F7A5C',
  secondarySoft: '#E7F5EF',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#19324A',
  muted: '#566A7D',
  border: '#DCE4EB',
  danger: '#B3343F',
  dangerSoft: '#F7D9DC',
  warning: '#8A5A12',
  warningSoft: '#FFF0D5',
  success: '#146B53',
  successSoft: '#DDF4EA',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 20 };

export const shadow = Platform.select({
  ios: {
    shadowColor: '#19324A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
});
