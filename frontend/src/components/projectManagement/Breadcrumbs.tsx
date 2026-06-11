import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      <Link 
        to="/admin/project-management" 
        className="flex items-center hover:text-[var(--emerald-dark)] transition-colors"
        title="Back to Projects"
      >
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          {item.href ? (
            <Link
              to={item.href}
              className="hover:text-[var(--emerald-dark)] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900 font-bold">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
