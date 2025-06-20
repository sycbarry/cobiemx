import React, { useState } from 'react';

interface FilterSectionProps {
  title: string;
  items: string[];
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
  searchPlaceholder?: string;
}

export default function FilterSection({
  title,
  items,
  selectedItems,
  onSelectionChange,
  searchPlaceholder = 'Search...'
}: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(item =>
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (item: string) => {
    const newSelection = selectedItems.includes(item)
      ? selectedItems.filter(i => i !== item)
      : [...selectedItems, item];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange(filteredItems);
  }

  const handleClearAll = () => {
    onSelectionChange([]);
  }

  return (
    <div className="mb-2">
      <button
        className="w-full flex justify-between items-center py-2 px-3 text-left font-semibold text-base text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <span className="text-sm bg-blue-500 text-white px-1 rounded">
              {selectedItems.length}
            </span>
          )}
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      
      {isOpen && (
        <div className="mt-1 p-2 bg-white border border-gray-300 rounded shadow-sm">
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="flex justify-between mb-2">
            <button 
              className="text-sm text-blue-600 hover:underline" 
              onClick={handleSelectAll}
            >
              All
            </button>
            <button 
              className="text-sm text-gray-500 hover:underline" 
              onClick={handleClearAll}
            >
              Clear
            </button>
          </div>
          
          <div className="max-h-24 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-1">No items</div>
            ) : (
              filteredItems.map(item => (
                <label key={item} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-gray-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item)}
                    onChange={() => handleToggle(item)}
                    className="h-3 w-3 text-blue-600"
                  />
                  <span className="text-sm truncate">{item}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 