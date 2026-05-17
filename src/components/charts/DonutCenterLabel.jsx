import { useRef, useLayoutEffect } from 'react';
import './donutCenterLabel.css';

/** Bütçe sayfası: bp-donut-value ≈ 1.25rem (20px) */
const SIZE_PRESETS = {
  default: {
    valueMaxScale: 0.12,
    valueMaxCap: 28,
    valueMin: 8,
    captionMaxScale: 0.055,
    captionMaxCap: 13,
    captionMin: 7,
  },
  budget: {
    valueMaxScale: 0.085,
    valueMaxCap: 20,
    valueMin: 9,
    captionMaxScale: 0.048,
    captionMaxCap: 11,
    captionMin: 7,
  },
};

/**
 * Dilim grafik merkez metni — asla "…" ile kesilmez;
 * kapsayıcı daraldıkça font boyutu küçülür.
 */
const DonutCenterLabel = ({
  value,
  caption = null,
  holeRatio = 0.52,
  variant = 'default',
  className = '',
  valueClassName = '',
  captionClassName = '',
}) => {
  const preset = SIZE_PRESETS[variant] ?? SIZE_PRESETS.default;
  const rootRef = useRef(null);
  const valueRef = useRef(null);
  const captionRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const el = valueRef.current;
    if (!root || !el) return;

    const fitElement = (node, { maxFont, minFont, maxWidth }) => {
      let size = maxFont;
      node.style.whiteSpace = 'nowrap';
      node.style.overflow = 'visible';
      node.style.textOverflow = 'clip';
      node.style.maxWidth = 'none';
      node.style.width = 'auto';
      node.style.display = 'block';
      node.style.fontSize = `${size}px`;
      while (size > minFont && node.scrollWidth > maxWidth) {
        size -= 0.5;
        node.style.fontSize = `${size}px`;
      }
    };

    const fit = () => {
      const wrap = root.closest('.ap-donut-chart-wrap, .budget-donut-chart');
      if (!wrap) return;

      const maxWidth = wrap.clientWidth * holeRatio;
      fitElement(el, {
        maxFont: Math.max(
          preset.valueMin + 2,
          Math.min(preset.valueMaxCap, wrap.clientWidth * preset.valueMaxScale)
        ),
        minFont: preset.valueMin,
        maxWidth,
      });

      const cap = captionRef.current;
      if (cap) {
        fitElement(cap, {
          maxFont: Math.max(
            preset.captionMin + 1,
            Math.min(preset.captionMaxCap, wrap.clientWidth * preset.captionMaxScale)
          ),
          minFont: preset.captionMin,
          maxWidth: maxWidth * 1.05,
        });
      }
    };

    fit();
    const wrap = root.closest('.ap-donut-chart-wrap, .budget-donut-chart');
    const ro = new ResizeObserver(fit);
    if (wrap) ro.observe(wrap);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [value, holeRatio, variant]);

  return (
    <div ref={rootRef} className={`donut-center-label ${className}`.trim()}>
      <span ref={valueRef} className={`donut-center-value ${valueClassName}`.trim()}>
        {value}
      </span>
      {caption != null && caption !== '' && (
        <span ref={captionRef} className={`donut-center-caption ${captionClassName}`.trim()}>
          {caption}
        </span>
      )}
    </div>
  );
};

export default DonutCenterLabel;
