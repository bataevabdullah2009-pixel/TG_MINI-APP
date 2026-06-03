type CategoryTabsProps = {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
};

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {categories.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onCategoryChange(name)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
            activeCategory === name ? "bg-slate-950 text-white" : "bg-white text-slate-600"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
