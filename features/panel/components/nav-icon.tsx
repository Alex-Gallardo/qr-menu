import {
  BadgeCheckIcon,
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarClockIcon,
  ClipboardListIcon,
  EllipsisIcon,
  HouseIcon,
  LandmarkIcon,
  PaletteIcon,
  QrCodeIcon,
  StarIcon,
  StoreIcon,
  UsersIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconName } from "../nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: HouseIcon,
  orders: ClipboardListIcon,
  products: UtensilsCrossedIcon,
  menus: BookOpenIcon,
  schedule: CalendarClockIcon,
  branches: StoreIcon,
  appearance: PaletteIcon,
  qr: QrCodeIcon,
  reviews: StarIcon,
  analytics: BarChart3Icon,
  team: UsersIcon,
  business: Building2Icon,
  payments: LandmarkIcon,
  notifications: BellIcon,
  license: BadgeCheckIcon,
  more: EllipsisIcon,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className={className} />;
}
