import {
  BarChartOutlined,
  FireOutlined,
  LineChartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { fetchDashboard } from "../api";
import { BarChart, LineChart, PieChart } from "../components/charts";
import { EmptyState, PanelLoading } from "../components/feedback";
import { Card, StatCard } from "../components/ui";
import type { DashboardData } from "../types";
import { appErrorMessage, formatPercent } from "../utils/text";

const chartPanelClass =
  "rounded-[18px] border-[4px] border-dashed border-slate-300 bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_18px,#f7f4ef_18px,#f7f4ef_30px)] px-4 py-3";

export function DashboardPage({
  setGlobalError,
}: {
  setGlobalError: (value: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((result) => {
        if (!active) return;
        setData(result);
        setGlobalError("");
      })
      .catch((error) => {
        if (active) setGlobalError(appErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setGlobalError]);

  if (loading && !data) {
    return <PanelLoading text="正在加载工作台数据..." />;
  }

  if (!data) {
    return <EmptyState title="工作台数据加载失败" />;
  }

  const publishRate = data.stats.totalCourses
    ? (data.stats.publishedCourses / data.stats.totalCourses) * 100
    : 0;
  const activeRate = data.stats.totalStudents
    ? (data.stats.activeStudents / data.stats.totalStudents) * 100
    : 0;
  const topCategoryItems = (() => {
    const sorted = [...data.charts.categoryDist].sort((a, b) => b.value - a.value);
    const topThree = sorted.slice(0, 3);
    const otherValue = sorted.slice(3).reduce((sum, item) => sum + item.value, 0);
    return otherValue > 0 ? [...topThree, { name: "其他", value: otherValue }] : topThree;
  })();

  return (
    <div className="w-full space-y-7">
      <h2 className="m-0 text-[32px] font-extrabold text-slate-900">工作台</h2>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BarChartOutlined />}
          label="课程总数"
          value={String(data.stats.totalCourses)}
          subValue={`/ 已发布 ${data.stats.publishedCourses}`}
        />
        <StatCard
          icon={<TeamOutlined />}
          label="学生总数"
          value={String(data.stats.totalStudents)}
          subValue={`/ 活跃 ${data.stats.activeStudents}`}
        />
        <StatCard
          icon={<LineChartOutlined />}
          label="课程发布率"
          value={formatPercent(publishRate)}
          subValue=""
        />
        <StatCard
          icon={<FireOutlined />}
          label="学生活跃率"
          value={formatPercent(activeRate)}
          subValue=""
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card title="课程选课人数 TOP 8">
          <div className={chartPanelClass}>
            <BarChart items={data.charts.enrollment.slice(0, 8)} />
          </div>
        </Card>
        <Card title="近 7 天学习活跃度">
          <div className={chartPanelClass}>
            <LineChart items={data.charts.activity} />
          </div>
        </Card>
        <Card title="学生状态分布">
          <div className={chartPanelClass}>
            <PieChart items={data.charts.statusDist} />
          </div>
        </Card>
        <Card title="课程分类分布">
          <div className={chartPanelClass}>
            <PieChart items={topCategoryItems} />
          </div>
        </Card>
      </section>
    </div>
  );
}
