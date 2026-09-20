// Pure chart geometry. Identical in every app — no styling decisions here.

export const SPARK_W = 84;
export const SPARK_H = 26;

export function sparklinePoints(series: number[]): string {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = SPARK_W / (series.length - 1);
  return series
    .map((v, i) => `${(i * step).toFixed(1)},${(SPARK_H - ((v - min) / span) * SPARK_H).toFixed(1)}`)
    .join(" ");
}

export const CHART_W = 640;
export const CHART_H = 210;
export const CHART_PAD_B = 22;
export const CHART_PAD_L = 26;

export function barLayout(count: number) {
  const plotW = CHART_W - CHART_PAD_L;
  const slot = plotW / count;
  const barW = Math.min(13, slot * 0.34);
  const gap = 3;
  return { plotW, slot, barW, gap, plotH: CHART_H - CHART_PAD_B };
}

export function barRect(index: number, value: number, max: number, offset: number) {
  const { slot, barW, gap, plotH } = barLayout(12);
  const h = (value / max) * (plotH - 10);
  return {
    x: CHART_PAD_L + index * slot + slot / 2 - barW - gap / 2 + offset * (barW + gap),
    y: plotH - h,
    width: barW,
    height: Math.max(h, 1),
  };
}

export const CHART_MAX = 100;
export const GRID_LINES = [0, 25, 50, 75, 100];

export function gridY(value: number) {
  const { plotH } = barLayout(12);
  return plotH - (value / CHART_MAX) * (plotH - 10);
}
