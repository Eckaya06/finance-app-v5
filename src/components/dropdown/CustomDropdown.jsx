// src/components/dropdown/CustomDropdown.jsx

// 1. useEffect ve useRef import edildi
import { useEffect, useRef } from 'react';
import './CustomDropdown.css';

const CustomDropdown = ({ options, selectedValue, onChange, labelPrefix, displayTransformer, isOpen, onToggle }) => {
  
  // 2. Dropdown kutusunun sınırlarını belirlemek için bir referans oluşturuyoruz
  const dropdownRef = useRef(null);

  // 3. Dışarı tıklamayı algılayan useEffect
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Eğer menü açıksa (isOpen) VE tıklanan yer (event.target) bizim kutunun (dropdownRef) içinde değilse:
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(); // Menüyü kapat
      }
    };

    // Sayfadaki tüm tıklamaları dinle
    document.addEventListener('mousedown', handleClickOutside);
    
    // Temizlik: Bileşen ekrandan gidince dinlemeyi bırak (Performans için önemli)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleSelect = (value) => {
    onChange(value);
    onToggle(); 
  };

  const getDisplayLabel = (value) => {
    const text = displayTransformer ? displayTransformer(value) : value;
    // labelPrefix opsiyonel: form alanlarında ayrı bir <label> kullanılıyorsa
    // boş geçilir ve sadece seçili değer gösterilir.
    return labelPrefix ? `${labelPrefix}: ${text}` : text;
  };

  const getOptionLabel = (value) => {
    if (displayTransformer) {
        return displayTransformer(value);
    }
    return value;
  }

  return (
    // 4. Referansı (ref={dropdownRef}) en dıştaki kapsayıcıya veriyoruz
    <div className="dropdown-container" ref={dropdownRef}>
      {/* type="button" zorunlu — bu komponent form içinde kullanıldığında
          (örn. RecurringBills "Yeni Fatura" formu) default type="submit"
          olduğu için tıklama form'u submit ediyordu. */}
      <button type="button" className="dropdown-selected" onClick={onToggle}>
        <span className="selected-label-text">{getDisplayLabel(selectedValue)}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <ul className="dropdown-options">
          {options.map((optionValue) => (
            <li 
              key={optionValue} 
              className="dropdown-option"
              onClick={() => handleSelect(optionValue)}
            >
              {getOptionLabel(optionValue)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomDropdown;