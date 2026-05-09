/* 
模块：学生状态分布饼图
定位：展示活跃/非活跃学生比例，并在圆心展示总数
数据：items[{ name, value }]
*/
import { useMemo } from "react";
import { parseMaybeChinese, trimLabel } from "../../utils/text";
import { ChartContainer, type ChartOption } from "./chart-core";
import { chartColors } from "./chart-theme";

export function StudentStatusChart({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const option = useMemo<ChartOption>(
    () => ({
      color: [chartColors[1], chartColors[6]],
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical",
        right: 8,
        top: "middle",
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: "#475569", fontWeight: 700 },
        formatter: (name) => trimLabel(parseMaybeChinese(name), 8),
      },
      series: [
        {
          name: "学生状态",
          type: "pie",
          radius: ["42%", "68%"],
          center: ["36%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#fffdf8",
            borderWidth: 3,
          },
          label: {
            formatter: "{c}",
            color: "#334155",
            fontWeight: 700,
          },
          data: items.map((item) => ({
            name: parseMaybeChinese(item.name),
            value: item.value,
          })),
        },
      ],
      graphic: {
        type: "group",
        left: "31%",
        top: "43%",
        children: [
          {
            type: "text",
            style: {
              text: "学生",
              fill: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
            },
          },
          {
            type: "text",
            top: 24,
            style: {
              text: String(total),
              fill: "#111827",
              fontSize: 24,
              fontWeight: 800,
              textAlign: "center",
            },
          },
        ],
      },
    }),
    [items, total],
  );

  return <ChartContainer option={option} className="h-62.5 min-w-65" />;
}
