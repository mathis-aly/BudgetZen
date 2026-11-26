'use client';

import React from 'react';
import {
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Tv,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Home,
  ShoppingCart,
  Utensils,
  Car,
  Tv,
  ShoppingBag,
  Dumbbell,
  HeartPulse,
  Briefcase,
  Sparkles,
  Coffee,
  Plane,
  Gift,
  Smartphone,
  Zap,
  CreditCard,
  PiggyBank,
  GraduationCap,
  PawPrint,
  Music,
  Fuel,
  Laptop,
  Wallet,
  Tag,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export const CATEGORY_COLORS = [
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#FF3B30',
  '#AF52DE',
  '#5856D6',
  '#FF2D55',
  '#00C7BE',
  '#32ADE6',
  '#FFCC00',
  '#A2845E',
  '#636366',
];

export function CategoryIcon({
  icon,
  color = '#007AFF',
  size = 'md',
  className,
}: {
  icon: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const IconComponent = CATEGORY_ICONS[icon] ?? Tag;

  const boxSizes = {
    sm: 'h-7 w-7 rounded-sm',
    md: 'h-9 w-9 rounded-md',
    lg: 'h-11 w-11 rounded-md',
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0 border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#1E1E1B]',
        boxSizes[size],
        className
      )}
      style={{
        color,
      }}
    >
      <IconComponent className={iconSizes[size]} strokeWidth={1.85} />
    </div>
  );
}
