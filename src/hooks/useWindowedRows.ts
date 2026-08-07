import { useCallback, useMemo, useRef, useState } from "react";

export type WindowedResult = {
  /** ref para o container com scroll */
  containerRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  /** índice inicial e final (exclusivo) das linhas a renderizar */
  start: number;
  end: number;
  /** altura das linhas omitidas antes/depois (spacers) */
  padTop: number;
  padBottom: number;
  /** true quando a virtualização está ativa */
  active: boolean;
  scrollTo: (index: number) => void;
};

/**
 * Renderização por janela para tabelas grandes, preservando a semântica de
 * <table> (usa linhas espaçadoras em vez de posicionamento absoluto).
 * Abaixo de `threshold` linhas a lista é renderizada integralmente — evita
 * overhead e mantém o comportamento previsível em listas curtas.
 */
export function useWindowedRows(
  count: number,
  { rowHeight = 56, viewport = 560, overscan = 8, threshold = 50 } = {},
): WindowedResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const active = count > threshold;

  const onScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  const scrollTo = useCallback((index: number) => {
    containerRef.current?.scrollTo({ top: Math.max(0, index * rowHeight - viewport / 2), behavior: "smooth" });
  }, [rowHeight, viewport]);

  return useMemo(() => {
    if (!active) {
      return { containerRef, onScroll, start: 0, end: count, padTop: 0, padBottom: 0, active, scrollTo };
    }
    const visible = Math.ceil(viewport / rowHeight);
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(count, start + visible + overscan * 2);
    return {
      containerRef, onScroll, start, end, active, scrollTo,
      padTop: start * rowHeight,
      padBottom: Math.max(0, (count - end) * rowHeight),
    };
  }, [active, count, scrollTop, rowHeight, viewport, overscan, onScroll, scrollTo]);
}
