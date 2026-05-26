/* 
模块：ECharts 容器
定位：注册按需组件，提供 ChartContainer 负责实例化/自适应/更新 option
用法：传入 option 与可选 className，图表组件仅专注配置 option，不负责状态管理
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

// 注册图表组件
echarts.use([
  EchartsBarChart, // 柱状图
  EchartsLineChart, // 折线图
  EchartsPieChart, // 饼图
  GridComponent, // 直角坐标系
  LegendComponent, // 图例
  TooltipComponent, // 提示框
  CanvasRenderer, // 画布渲染器
]);

// 定义这个容器能接受的 option 类型。
export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>;

// 默认图表容器样式
export function ChartContainer({
  option, // 图表配置
  className = "h-62.5", // 容器样式
}: {
  option: ChartOption; 
  className?: string; 
}) {
  const chartRef = useRef<HTMLDivElement | null>(null); // 图表容器引用
  const instanceRef = useRef<ECharts | null>(null); // 图表实例引用

  // 初始化图表实例
  useEffect(() => {
    if (!chartRef.current) return;

    // 图表实例只在容器挂载后创建一次，后续仅更新 option，避免重复 init/dispose。
    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const handleResize = () => chart.resize(); // 监听窗口大小变化，并调用图表实例的 resize 方法以自适应。
    window.addEventListener("resize", handleResize);// 添加窗口大小变化监听器

    return () => {
      // 页面卸载时释放实例和事件监听，避免内存泄漏。
      window.removeEventListener("resize", handleResize);// 移除窗口大小变化监听器
      chart.dispose();// 释放图表实例
      instanceRef.current = null;// 清空图表实例引用
    };
  }, []);

  // 更新图表配置
  useEffect(() => {
    // notMerge=true 保证每次都以最新配置重绘，避免不同图表状态相互污染。
    const setOptionConfig: SetOptionOpts = { notMerge: true }; // 更新图表配置选项
    instanceRef.current?.setOption(option, setOptionConfig); // 更新图表配置   
  }, [option]);

  return <div ref={chartRef} className={`w-full ${className}`} />;
}
