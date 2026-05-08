import { useMemo } from "react";
import { parseMaybeChinese } from "../../utils/text";
import { ChartContainer, type ChartOption } from "./chart-core";
import { chartColors } from "./chart-theme";

export function LearningActivityChart({
  items,
}: {
  items: Array<{
    date: string;
    label: string;
    students: number;
    duration: number;
  }>;
}) {
  const option = useMemo<ChartOption>(
    () => ({
      color: [chartColors[0], chartColors[1]],
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        right: 8,
        textStyle: { color: "#475569", fontWeight: 700 },
      },
      grid: {
        top: 42,
        right: 20,
        bottom: 36,
        left: 44,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: items.map((item) => parseMaybeChinese(item.label)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { type: "dashed", color: "#dbe3ee" } },
        axisLabel: { color: "#64748b" },
      },
      series: [
        {
          name: "学习人数",
          type: "line",
          smooth: true,
          data: items.map((item) => item.students),
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 4 },
        },
        {
          name: "学习时长",
          type: "line",
          smooth: true,
          data: items.map((item) => item.duration),
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 4 },
        },
      ],
    }),
    [items],
  );

  return <ChartContainer option={option} />;
}
