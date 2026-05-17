import { useRef, useState, useLayoutEffect } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * Recharts width/height -1 uyarısını önler: önce kapsayıcı ölçülür, sonra sayısal boyut verilir.
 * `fill` — üst eleman position:relative + yükseklik iken absolute inset:0 ile doldurur.
 */
const ResponsiveChart = ({
  children,
  debounce = 0,
  className = '',
  style = {},
  fill = false,
}) => {
  const wrapRef = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const host = wrapRef.current;
      if (!host) return;

      let rect = host.getBoundingClientRect();
      let w = Math.floor(rect.width);
      let h = Math.floor(rect.height);

      if ((w <= 0 || h <= 0) && host.parentElement) {
        const parentRect = host.parentElement.getBoundingClientRect();
        if (w <= 0 && parentRect.width > 0) w = Math.floor(parentRect.width);
        if (h <= 0 && parentRect.height > 0) h = Math.floor(parentRect.height);
      }

      if (w > 0 && h > 0) {
        setSize((prev) =>
          prev?.width === w && prev?.height === h ? prev : { width: w, height: h }
        );
      }
    };

    measure();
    const raf = requestAnimationFrame(measure);

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const hostClass = [
    'responsive-chart-host',
    fill ? 'responsive-chart-host--fill' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={wrapRef}
      className={hostClass}
      style={{ width: '100%', minWidth: 0, minHeight: fill ? undefined : 1, ...style }}
    >
      {size && size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer width={size.width} height={size.height} debounce={debounce}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default ResponsiveChart;
