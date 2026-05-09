/* 
模块：课程选课人数柱状图
定位：展示 TOP 列表的课程选课人数对比
数据：items[{ name, value }]
*/
import { useMemo } from "react";
import { parseMaybeChinese, trimLabel } from "../../utils/text";
import { ChartContainer, type ChartOption } from "./chart-core";
import { chartColors } from "./chart-theme";

export function CourseEnrollmentChart({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const option = useMemo<ChartOption>(
    () => ({
      color: [chartColors[0]],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      grid: {
        top: 28,
        right: 16,
        bottom: 42,
        left: 44,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: items.map((item) => trimLabel(parseMaybeChinese(item.name), 6)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 12,
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { type: "dashed", color: "#dbe3ee" } },
        axisLabel: { color: "#64748b" },
      },
      series: [
        {
          name: "选课人数",
          type: "bar",
          data: items.map((item) => item.value),
          barMaxWidth: 42,
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#9bc8ff" },
                { offset: 1, color: "#2f68e6" },
              ],
            },
          },
          label: {
            show: true,
            position: "top",
            color: "#334155",
            fontWeight: 700,
          },
        },
      ],
    }),
    [items],
  );

  return <ChartContainer option={option} />;
}
