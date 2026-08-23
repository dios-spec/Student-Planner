import {
  Backpack,
  BookMarked,
  BookOpen,
  BookOpenText,
  Calculator,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Globe2,
  Languages,
  Megaphone,
  PencilLine,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

const APP_ICONS: Record<string, LucideIcon> = {
  Backpack,
  BookMarked,
  BookOpen,
  BookOpenText,
  Calculator,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Globe2,
  Languages,
  Megaphone,
  PencilLine,
  ScrollText,
};

export function appIcon(name: string): LucideIcon {
  return APP_ICONS[name] || BookMarked;
}
