import { useState, useRef, useEffect } from 'react';

export default function SuggestionInput({ value, onChange, suggestions, placeholder, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = suggestions.filter((s) =>
    String(s || '').toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item) => {
    onChange?.(item);
    setQuery(item);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    onChange?.(val);
  };

  const handleFocus = () => {
    setOpen(true);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={handleInputChange}
        onFocus={handleFocus}
        autoComplete="off"
        className="suggestion-input"
      />
      {open && filtered.length > 0 && (
        <div className="suggestion-dropdown">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="suggestion-option"
              onMouseDown={() => handleSelect(item)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
