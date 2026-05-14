/* 
模块：工作台页面
定位：展示课程与学生统计概览与图表
数据流：挂载时 useDashboardStore.refresh() 获取数据；失败显示 EmptyState
用法：受保护路由下直接渲染，样式用卡片 + 自定义图表容器组合
*/
import {
  BarChartOutlined,
  FireOutlined,
  LineChartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { lazy, Suspense, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { EmptyState, PanelLoading } from "../components/feedback";
import { Card, StatCard } from "../components/ui";
import { useDashboardStore } from "../stores/dashboard-store";
import { formatPercent } from "../utils/text";

const CourseEnrollmentChart = lazy(() =>
  import("../components/echarts/CourseEnrollmentChart").then((module) => ({
    default: module.CourseEnrollmentChart,
  })),
);
const LearningActivityChart = lazy(() =>
  import("../components/echarts/LearningActivityChart").then((module) => ({
    default: module.LearningActivityChart,
  })),
);
const StudentStatusChart = lazy(() =>
  import("../components/echarts/StudentStatusChart").then((module) => ({
    default: module.StudentStatusChart,
  })),
);
const CourseCategoryChart = lazy(() =>
  import("../components/echarts/CourseCategoryChart").then((module) => ({
    default: module.CourseCategoryChart,
  })),
);

const chartPanelClass =
  "rounded-4.5 border-4 border-dashed border-slate-300 bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_18px,#f7f4ef_18px,#f7f4ef_30px)] px-4 py-3";
const chartFallback = <PanelLoading text="正在加载图表..." />;

export function DashboardPage() {
  const { data, loading, refresh } = useDashboardStore(
    useShallow((state) => ({
      data: state.data,
      loading: state.loading,
      refresh: state.refresh,
    }))
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      <h2 className="m-0 text-4xl font-extrabold text-slate-900">工作台</h2>

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
            <Suspense fallback={chartFallback}>
              <CourseEnrollmentChart items={data.charts.enrollment.slice(0, 8)} />
            </Suspense>
          </div>
        </Card>
        <Card title="近 7 天学习活跃度">
          <div className={chartPanelClass}>
            <Suspense fallback={chartFallback}>
              <LearningActivityChart items={data.charts.activity} />
            </Suspense>
          </div>
        </Card>
        <Card title="学生状态分布">
          <div className={chartPanelClass}>
            <Suspense fallback={chartFallback}>
              <StudentStatusChart items={data.charts.statusDist} />
            </Suspense>
          </div>
        </Card>
        <Card title="课程分类分布">
          <div className={chartPanelClass}>
            <Suspense fallback={chartFallback}>
              <CourseCategoryChart items={topCategoryItems} />
            </Suspense>
          </div>
        </Card>
      </section>
    </div>
  );
}
