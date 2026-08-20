import { Megaphone } from 'lucide-react';
import type { PlannerItem } from '../../types';

export default function ImportantBanner({ items }: { items: PlannerItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 rounded-2xl bg-coral-soft px-4 py-3">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-coral" />
          <div>
            <p className="text-sm font-semibold text-coral">{item.title}</p>
            {item.description && <p className="text-xs text-coral/80">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
