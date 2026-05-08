import { parseMaybeChinese, trimLabel } from "../utils/text";

export function BarChart({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const width = 700;
  const height = 300;
  const gap = 20;
  const barWidth = items.length
    ? (420 - gap * (items.length - 1)) / items.length
    : 0;

  return (
    <div className="flex justify-center overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[250px] w-full max-w-[700px]"
      >
        <defs>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9bc8ff" />
            <stop offset="100%" stopColor="#2f68e6" />
          </linearGradient>
        </defs>
        <line
          x1="110"
          y1="230"
          x2="560"
          y2="230"
          stroke="#c7d2e0"
          strokeWidth="2"
        />
        {items.map((item, index) => {
          const valueHeight = (item.value / maxValue) * 138;
          const x = 136 + index * (barWidth + gap);
          const y = 230 - valueHeight;

          return (
            <g key={item.name}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={valueHeight}
                rx="9"
                fill="url(#barGradient)"
              />
              <text
                x={x + barWidth / 2}
                y={y - 10}
                textAnchor="middle"
                fill="#334155"
                fontSize="13"
                fontWeight="700"
              >
                {item.value}
              </text>
              <text
                x={x + barWidth / 2}
                y="258"
                textAnchor="middle"
                fill="#64748b"
                fontSize="12"
              >
                {trimLabel(parseMaybeChinese(item.name), 6)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({
  items,
}: {
  items: Array<{
    date: string;
    label: string;
    students: number;
    duration: number;
  }>;
}) {
  const width = 700;
  const height = 300;
  const maxValue = Math.max(
    ...items.flatMap((item) => [item.students, item.duration]),
    1,
  );
  const step = items.length > 1 ? 420 / (items.length - 1) : 0;

  const buildPath = (values: number[]) =>
    values
      .map((value, index) => {
        const x = 110 + index * step;
        const y = 230 - (value / maxValue) * 138;
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");

  return (
    <div className="flex justify-center overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[250px] w-full max-w-[700px]"
      >
        <line
          x1="100"
          y1="230"
          x2="560"
          y2="230"
          stroke="#c7d2e0"
          strokeWidth="2"
        />
        <path
          d={buildPath(items.map((item) => item.students))}
          fill="none"
          stroke="#2e69e6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={buildPath(items.map((item) => item.duration))}
          fill="none"
          stroke="#19a35b"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {items.map((item, index) => {
          const x = 110 + index * step;
          const studentY = 230 - (item.students / maxValue) * 138;
          const durationY = 230 - (item.duration / maxValue) * 138;

          return (
            <g key={item.date}>
              <circle cx={x} cy={studentY} r="5" fill="#2e69e6" />
              <circle cx={x} cy={durationY} r="5" fill="#19a35b" />
              <text
                x={x}
                y="258"
                textAnchor="middle"
                fill="#64748b"
                fontSize="12"
              >
                {parseMaybeChinese(item.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PieChart({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const palette = [
    "#b8d4f2",
    "#ffd2d0",
    "#d9f0d0",
    "#ffe5ad",
    "#ead9ff",
    "#ffe3f4",
    "#d7dde5",
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const segments = items.reduce<
    Array<{ name: string; value: number; startAngle: number; endAngle: number }>
  >((acc, item) => {
    const previousEndAngle = acc.length ? acc[acc.length - 1].endAngle : -90;
    const endAngle = previousEndAngle + (item.value / total) * 360;
    acc.push({
      name: item.name,
      value: item.value,
      startAngle: previousEndAngle,
      endAngle,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-center lg:gap-6">
      <div className="relative flex shrink-0 items-center justify-center">
        <svg viewBox="0 0 360 260" className="h-[240px] w-full max-w-[300px]">
          {segments.map((segment, index) => {
            const path = describeArc(
              144,
              132,
              74,
              segment.startAngle,
              segment.endAngle,
            );
            const shadowPath = describeArc(
              151,
              137,
              74,
              segment.startAngle,
              segment.endAngle,
            );
            const innerCutout = describeArc(
              144,
              132,
              38,
              segment.startAngle,
              segment.endAngle,
            );
            const color = palette[index % palette.length];

            return (
              <g key={segment.name}>
                <path d={shadowPath} fill="none" stroke="#222" strokeWidth="4" />
                <path d={path} fill={color} stroke="#222" strokeWidth="3" />
                <path d={innerCutout} fill="#fffdf8" stroke="none" />
              </g>
            );
          })}
          <circle cx="144" cy="132" r="37" fill="#fffdf8" stroke="#222" strokeWidth="3" />
          <text x="144" y="124" textAnchor="middle" fill="#64748b" fontSize="13" fontWeight="700">
            总计
          </text>
          <text x="144" y="148" textAnchor="middle" fill="#111827" fontSize="24" fontWeight="800">
            {total}
          </text>
        </svg>
      </div>

      <div className="grid w-full max-w-[220px] gap-2">
        {segments.map((segment, index) => {
          const color = palette[index % palette.length];
          const percent = `${Math.round((segment.value / total) * 100)}%`;

          return (
            <div
              key={segment.name}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white/75 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border-2 border-[#222]"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-[14px] font-semibold text-slate-700">
                  {trimLabel(parseMaybeChinese(segment.name), 8)}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-extrabold text-slate-900">
                  {segment.value}
                </div>
                <div className="text-[12px] text-slate-400">{percent}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${x} ${y} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}
