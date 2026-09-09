import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/** Sxemadagi tugun turi - shakli va rangi shunga qarab tanlanadi. */
type NodeKind = "substation" | "transformer" | "tp";

/** Kuchlanish darajasi - qirraning rangi va qalinligi shundan olinadi. */
type LineLevel = "110" | "35" | "10";

/**
 * Yorliqning tugunga nisbatan joyi: "middle" - tepada, "start" - o'ngda,
 * "end" - chapda. Har bir tugun uchun shox chiqmaydigan tomon tanlangan,
 * shuning uchun yorliqlar chiziqlar va bir-biri bilan kesishmaydi.
 */
type LabelAnchor = "start" | "middle" | "end";

interface TopologyNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label: string;
  anchor?: LabelAnchor;
}

interface TopologyEdge {
  from: string;
  to: string;
  level: LineLevel;
}

/**
 * Ierarxiya `domen.md` dagidek: podstansiya -> transformator -> fider -> TP.
 * Fider alohida tugun emas, u aynan 10 kV chiquvchi liniya (sxemada sariq
 * chiziq), uning uchidagi tugunlar esa TP lar. Shuning uchun TP-xxx deb
 * nomlangan barcha tugunlar bir xil belgi bilan chiziladi va raqamlari boshqa
 * kartalardagi (TransformerStatusCard, EventLogCard) ro'yxatlarga mos keladi.
 *
 * Koordinatalar 320x190 viewBox uchun qo'lda tanlangan (tasodifiy son yo'q -
 * sxema har renderda aynan bir xil chiqishi shart). To'rt qavat:
 * podstansiyalar (y=22), 35/10 kV transformatorlar (y=76) va 10 kV fider
 * liniyalaridagi TP lar (y=126 hamda undan tarmoqlangan y=170).
 */
const NODES: readonly TopologyNode[] = [
  // 1-qavat: 110 kV magistral bilan bog'langan ikki podstansiya.
  { id: "sarnovul", x: 100, y: 22, kind: "substation", label: "Sarnovul" },
  { id: "baliqchi", x: 236, y: 22, kind: "substation", label: "Baliqchi" },

  // 2-qavat: 35 kV shoxlardagi 35/10 kV transformatorlar.
  { id: "chinobod", x: 46, y: 76, kind: "transformer", label: "Chinobod", anchor: "end" },
  {
    id: "fayzobod",
    x: 162,
    y: 76,
    kind: "transformer",
    label: "Fayzobod",
    anchor: "start",
  },
  {
    id: "qorakol",
    x: 276,
    y: 76,
    kind: "transformer",
    label: "Qorako\u2019l",
    anchor: "start",
  },

  // 3-qavat: 10 kV fiderlarga ulangan transformator punktlari.
  { id: "tp-089", x: 38, y: 126, kind: "tp", label: "TP-089", anchor: "end" },
  { id: "tp-043", x: 104, y: 126, kind: "tp", label: "TP-043", anchor: "start" },
  { id: "tp-166", x: 198, y: 126, kind: "tp", label: "TP-166", anchor: "start" },
  { id: "tp-066", x: 278, y: 126, kind: "tp", label: "TP-066", anchor: "start" },

  // 4-qavat: fider magistralining oxiridagi TP lar.
  { id: "tp-046", x: 60, y: 170, kind: "tp", label: "TP-046", anchor: "start" },
  { id: "tp-226", x: 166, y: 170, kind: "tp", label: "TP-226", anchor: "start" },
  { id: "tp-119", x: 246, y: 170, kind: "tp", label: "TP-119", anchor: "start" },
];

/**
 * Tuzilma asosan daraxtsimon. TP-043, TP-166 va TP-046 ataylab ikkita
 * manbaga ulangan - real tarmoqdagi zaxira ta'minot shunday ko'rsatiladi.
 * Bu qo'shimcha qirralar boshqa chiziqlarni kesib o'tmaydi, faqat bitta
 * tugunda tutashadi.
 */
const EDGES: readonly TopologyEdge[] = [
  { from: "sarnovul", to: "baliqchi", level: "110" },

  { from: "sarnovul", to: "chinobod", level: "35" },
  { from: "sarnovul", to: "fayzobod", level: "35" },
  { from: "baliqchi", to: "fayzobod", level: "35" },
  { from: "baliqchi", to: "qorakol", level: "35" },

  { from: "chinobod", to: "tp-089", level: "10" },
  { from: "chinobod", to: "tp-043", level: "10" },
  { from: "fayzobod", to: "tp-043", level: "10" },
  { from: "fayzobod", to: "tp-166", level: "10" },
  { from: "qorakol", to: "tp-166", level: "10" },
  { from: "qorakol", to: "tp-066", level: "10" },
  { from: "tp-089", to: "tp-046", level: "10" },
  { from: "tp-043", to: "tp-046", level: "10" },
  { from: "tp-166", to: "tp-226", level: "10" },
  { from: "tp-066", to: "tp-119", level: "10" },
];

/** Qalinlik ham darajaga bog'liq: magistral eng yo'g'on, 10 kV eng ingichka. */
const LEVEL_STYLE: Record<LineLevel, { color: string; width: number }> = {
  "110": { color: "#ef4444", width: 1.6 },
  "35": { color: "#3b82f6", width: 1.2 },
  "10": { color: "#eab308", width: 1 },
};

/** Qirralar tugunlarni `id` orqali izlaydi - koordinata faqat bir joyda turadi. */
const NODE_BY_ID: ReadonlyMap<string, TopologyNode> = new Map(
  NODES.map((node) => [node.id, node] as const),
);

/**
 * Legenda nishonlari - chiziq, kvadrat va doira sinflari bir joyda. Nishon
 * o'lchami sxemadagi shaklga mos: TP nuqtasi (r=4) 8px, transformator doirasi
 * (r=5) va podstansiya kvadrati (11px) esa 10px.
 */
const LEGEND: readonly { id: string; mark: string; label: string }[] = [
  { id: "line-110", mark: "h-0.5 w-3.5 rounded bg-[#ef4444]", label: "110 kV liniya" },
  { id: "line-35", mark: "h-0.5 w-3.5 rounded bg-[#3b82f6]", label: "35 kV liniya" },
  { id: "line-10", mark: "h-0.5 w-3.5 rounded bg-[#eab308]", label: "10 kV fider" },
  { id: "substation", mark: "size-2.5 rounded-[2px] bg-[#2563eb]", label: "Podstansiya" },
  {
    id: "transformer",
    mark: "size-2.5 rounded-full border-2 border-[#2563eb] bg-surface",
    label: "Transformator",
  },
  { id: "tp", mark: "size-2 rounded-full bg-[#eab308]", label: "TP" },
];

/** Yorliq koordinatasi: yonda - markazga tekislangan, tepada - 10px yuqorida. */
function labelPosition(node: TopologyNode): { x: number; y: number } {
  if (node.anchor === "start") return { x: node.x + 9, y: node.y + 3 };
  if (node.anchor === "end") return { x: node.x - 9, y: node.y + 3 };
  return { x: node.x, y: node.y - 10 };
}

/** Tugun shakli. Ichma-ich shartli operatorlardan qochish uchun alohida. */
function NodeShape({ node }: { node: TopologyNode }) {
  if (node.kind === "substation") {
    return (
      <rect
        x={node.x - 5.5}
        y={node.y - 5.5}
        width={11}
        height={11}
        rx={2}
        fill="#2563eb"
      />
    );
  }
  if (node.kind === "tp") {
    return <circle cx={node.x} cy={node.y} r={4} fill="#eab308" />;
  }
  return (
    <circle cx={node.x} cy={node.y} r={5} fill="#ffffff" stroke="#2563eb" strokeWidth={2} />
  );
}

/**
 * Bosh sahifa, 4-qator (span-7, ~425x262).
 *
 * Sarlavha (32px) va 8px bo'shliqdan keyin tanaga 190px qoladi - sxemaning
 * viewBox balandligi ham shuning uchun 190. "meet" bilan berilgani karta
 * kengaysa sxema mutanosib kattayadi va hech qachon kartadan toshib ketmaydi.
 */
export function NetworkTopologyCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Tarmoq topologiyasi" />

      <CardBody>
        {/* Qatorni alohida o'ramchi beradi: `CardBody` ning o'zi `flex-col`. */}
        <div className="flex min-h-0 flex-1 items-stretch gap-2">
          <div className="flex w-[86px] shrink-0 flex-col justify-center gap-2 text-[9px] text-ink-muted">
            {LEGEND.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                {/* Nishonlar turli o'lchamda - 14px slot ularni bir chiziqqa tekislaydi. */}
                <span className="flex w-3.5 shrink-0 items-center justify-center">
                  <span className={item.mark} />
                </span>
                <span className="leading-tight whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <svg
              viewBox="0 0 320 190"
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full"
              role="img"
              aria-label="Elektr tarmoq topologiyasi sxemasi"
            >
              {/* Qirralar avval chiziladi - tugunlar ular ustida qoladi. */}
              {EDGES.map((edge) => {
                const from = NODE_BY_ID.get(edge.from);
                const to = NODE_BY_ID.get(edge.to);
                if (!from || !to) return null;
                const style = LEVEL_STYLE[edge.level];
                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={style.color}
                    strokeWidth={style.width}
                    strokeLinecap="round"
                  />
                );
              })}

              {NODES.map((node) => {
                const label = labelPosition(node);
                return (
                  <g key={node.id}>
                    <NodeShape node={node} />
                    <text
                      x={label.x}
                      y={label.y}
                      fontSize={8}
                      fill="#555555"
                      textAnchor={node.anchor ?? "middle"}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
