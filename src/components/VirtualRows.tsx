import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Lista virtualizada (renderização por janela) para tabelas grandes.
 * Mede as linhas dinamicamente para suportar linhas expansíveis.
 */
export function VirtualRows<T>({
  items, estimateSize = 56, height = 520, getKey, render, scrollToKey,
}: {
  items: T[];
  estimateSize?: number;
  height?: number;
  getKey: (item: T, index: number) => string;
  render: (item: T, index: number) => React.ReactNode;
  scrollToKey?: string | null;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });

  useEffect(() => {
    if (!scrollToKey) return;
    const idx = items.findIndex((it, i) => getKey(it, i) === scrollToKey);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToKey, items.length]);

  return (
    <div ref={parentRef} data-testid="virtual-scroll" className="overflow-y-auto" style={{ maxHeight: height }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map(v => (
          <div
            key={getKey(items[v.index], v.index)}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}
          >
            {render(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualRows;
