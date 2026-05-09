/* 
模块：ECharts 容器
定位：注册按需组件，提供 ChartContainer 负责实例化/自适应/更新 option
用法：传入 option 与可选 className，图表组件仅专注配置
*/
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

    // 图表实例只在容器挂载后创建一次，后续仅更新 option，避免重复 init/dispose。
    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      // 页面卸载时释放实例和事件监听，避免内存泄漏。
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    // notMerge=true 保证每次都以最新配置重绘，避免不同图表状态相互污染。
    const setOptionConfig: SetOptionOpts = { notMerge: true };
    instanceRef.current?.setOption(option, setOptionConfig);
  }, [option]);

  return <div ref={chartRef} className={`w-full ${className}`} />;
}
