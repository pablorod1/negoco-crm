"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { euros, eurosRound, type StudyOfferView } from "./api";

const HEIGHT = 280;
const PAD = { top: 16, right: 20, bottom: 36, left: 52 };
const HIT_RADIUS = 24;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Cuatro o cinco marcas redondas entre min y max. */
function ticks(min: number, max: number) {
  const span = max - min || 1;
  const raw = span / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * power)
      .find((candidate) => candidate >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const values: number[] = [];
  for (let value = start; value <= max + step * 0.001; value += step)
    values.push(Math.round(value * 100) / 100);
  return values;
}

type Point = {
  offer: StudyOfferView;
  x: number;
  y: number;
  px: number;
  py: number;
};

/**
 * Cada tarifa como un punto: a la derecha ahorra más el cliente, arriba cobra
 * más la agencia. Lo mejor para los dos queda arriba a la derecha. Solo lo ven
 * quienes ven la comisión.
 */
export function OfferScatter({
  offers,
  proposalKeys,
  selectedKey,
  onSelect,
  hasCurrent,
}: {
  offers: StudyOfferView[];
  proposalKeys: ReadonlySet<string>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  hasCurrent: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Point | null>(null);
  const withCommission = offers.filter((offer) => offer.commission !== null);
  const missing = offers.length - withCommission.length;
  const xOf = (offer: StudyOfferView) =>
    hasCurrent ? (offer.savings ?? 0) : offer.cost.total;

  const chart = (() => {
    if (withCommission.length === 0 || width === 0) return null;
    const xs = withCommission.map(xOf);
    const ys = withCommission.map((offer) => offer.commission ?? 0);
    const xTicks = ticks(
      Math.min(hasCurrent ? 0 : Infinity, ...xs),
      Math.max(...xs),
    );
    const yTicks = ticks(0, Math.max(...ys, 1));
    const [x0, x1] = [xTicks[0], xTicks.at(-1)!];
    const [y0, y1] = [yTicks[0], yTicks.at(-1)!];
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const sx = (value: number) =>
      PAD.left + ((value - x0) / (x1 - x0 || 1)) * innerW;
    const sy = (value: number) =>
      PAD.top + innerH - ((value - y0) / (y1 - y0 || 1)) * innerH;
    const points: Point[] = withCommission.map((offer) => ({
      offer,
      x: xOf(offer),
      y: offer.commission ?? 0,
      px: sx(xOf(offer)),
      py: sy(offer.commission ?? 0),
    }));
    // Lo mejor para el cliente: más ahorro o, sin lo de hoy, menos coste.
    const better = (point: Point, best: Point) =>
      hasCurrent ? point.x > best.x : point.x < best.x;
    const bestSavings = points.reduce((best, point) =>
      better(point, best) ? point : best,
    );
    const bestCommission = points.reduce((best, point) =>
      point.y > best.y ? point : best,
    );
    return {
      points,
      xTicks,
      yTicks,
      sx,
      sy,
      innerH,
      bestSavings,
      bestCommission,
    };
  })();

  const nearest = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!chart) return null;
    const box = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - box.left;
    const my = event.clientY - box.top;
    let found: Point | null = null;
    let distance = HIT_RADIUS;
    for (const point of chart.points) {
      const d = Math.hypot(point.px - mx, point.py - my);
      if (d < distance) {
        distance = d;
        found = point;
      }
    }
    return found;
  };

  if (withCommission.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-3">
        <p className="text-xs text-gray-500">
          {hasCurrent
            ? "Cada punto es una tarifa: arriba a la derecha, lo mejor para el cliente y para la agencia."
            : "Cada punto es una tarifa. Sin lo que paga hoy, el eje horizontal es su coste anual."}
        </p>
        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary-500" /> Mejora lo
            de hoy
          </span>
          {hasCurrent && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-gray-300" /> No mejora
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-white ring-2 ring-primary-800" />{" "}
            Con propuesta
          </span>
        </div>
      </div>
      <div ref={ref} className="relative px-2 pb-3 pt-2">
        {chart && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${chart.points.length} tarifas según ahorro y comisión`}
            className="block cursor-crosshair select-none"
            onMouseMove={(event) => setHover(nearest(event))}
            onMouseLeave={() => setHover(null)}
            onClick={(event) => {
              const point = nearest(event);
              if (point) onSelect(point.offer.key);
            }}
          >
            {chart.yTicks.map((tick) => (
              <g key={`y${tick}`}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={chart.sy(tick)}
                  y2={chart.sy(tick)}
                  className="stroke-gray-100"
                />
                <text
                  x={PAD.left - 8}
                  y={chart.sy(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-gray-400 text-[10px] tabular-nums"
                >
                  {eurosRound(tick)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((tick) => (
              <text
                key={`x${tick}`}
                x={chart.sx(tick)}
                y={HEIGHT - PAD.bottom + 16}
                textAnchor="middle"
                className="fill-gray-400 text-[10px] tabular-nums"
              >
                {eurosRound(tick)}
              </text>
            ))}
            <text
              x={width - PAD.right}
              y={HEIGHT - 4}
              textAnchor="end"
              className="fill-gray-500 text-[10px]"
            >
              {hasCurrent ? "Ahorro del cliente al año →" : "Coste anual →"}
            </text>
            <text
              x={PAD.left - 44}
              y={PAD.top - 4}
              className="fill-gray-500 text-[10px]"
            >
              Comisión ↑
            </text>
            {hasCurrent && chart.xTicks[0] < 0 && (
              <g>
                <line
                  x1={chart.sx(0)}
                  x2={chart.sx(0)}
                  y1={PAD.top}
                  y2={PAD.top + chart.innerH}
                  className="stroke-gray-300"
                  strokeDasharray="3 3"
                />
                <text
                  x={chart.sx(0) + 4}
                  y={PAD.top + 10}
                  className="fill-gray-400 text-[10px]"
                >
                  Paga lo mismo que hoy
                </text>
              </g>
            )}
            {chart.points.map((point) => {
              const good = !hasCurrent || (point.offer.savings ?? 0) > 0;
              const proposal = proposalKeys.has(point.offer.key);
              const active =
                point.offer.key === selectedKey ||
                point.offer.key === hover?.offer.key;
              return (
                <circle
                  key={point.offer.key}
                  cx={point.px}
                  cy={point.py}
                  r={active ? 7 : proposal ? 6 : 4.5}
                  strokeWidth={2}
                  className={
                    proposal
                      ? "fill-white stroke-primary-800"
                      : `${good ? "fill-primary-500" : "fill-gray-300"} stroke-white transition-[r]`
                  }
                  opacity={hover && !active ? 0.55 : 1}
                />
              );
            })}
            {[chart.bestSavings, chart.bestCommission]
              .filter(
                (point, index, all) =>
                  all.findIndex(
                    ({ offer }) => offer.key === point.offer.key,
                  ) === index,
              )
              .map((point) => (
                <text
                  key={`label-${point.offer.key}`}
                  x={point.px}
                  y={point.py - 11}
                  textAnchor={point.px > width - 120 ? "end" : "middle"}
                  className="pointer-events-none fill-gray-700 text-[11px] font-medium"
                >
                  {point.offer.comercializadoraName}
                </text>
              ))}
          </svg>
        )}

        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-gray-950/10"
            style={{
              left: Math.min(Math.max(hover.px + 8, 136), width - 128),
              top: hover.py - 6,
            }}
          >
            <div className="flex items-center gap-2">
              <SupplierLogo
                supplier={{
                  name: hover.offer.comercializadoraName,
                  logo: hover.offer.comercializadoraLogo,
                }}
                size={28}
              />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {hover.offer.comercializadoraName}
                </p>
                <p className="truncate text-gray-500">
                  {hover.offer.productName}
                </p>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 tabular-nums">
              <div>
                <dt className="text-gray-500">Coste</dt>
                <dd className="font-medium text-gray-900">
                  {eurosRound(hover.offer.cost.total)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Ahorro</dt>
                <dd className="font-medium text-gray-900">
                  {hover.offer.savings === null
                    ? "—"
                    : euros(hover.offer.savings)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Comisión</dt>
                <dd className="font-medium text-gray-900">
                  {euros(hover.offer.commission)}
                </dd>
              </div>
            </dl>
          </div>
        )}
        {missing > 0 && (
          <p className="px-3 text-xs text-gray-400">
            {missing}{" "}
            {missing === 1
              ? "tarifa no aparece: no tiene"
              : "tarifas no aparecen: no tienen"}{" "}
            comisión cargada.
          </p>
        )}
      </div>
    </div>
  );
}
