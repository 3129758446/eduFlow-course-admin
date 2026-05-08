import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart as EchartsBarChart,
  LineChart as EchartsLineChart,
  PieChart as EchartsPieChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption, ECharts, SetOptionOpts } from "echarts/core";
import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
} from "echarts/charts";
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components";

echarts.use([
  EchartsBarChart,
  EchartsLineChart,
  EchartsPieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>;

export function ChartContainer({
  option,
  className = "h-62.5",
}: {
  option: ChartOption;
  className?: string;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const setOptionConfig: SetOptionOpts = { notMerge: true };
    instanceRef.current?.setOption(option, setOptionConfig);
  }, [option]);

  return <div ref={chartRef} className={`w-full ${className}`} />;
}
