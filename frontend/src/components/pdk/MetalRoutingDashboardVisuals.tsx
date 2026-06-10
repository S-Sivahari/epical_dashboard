import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { CheckCircle2, Clock, Inbox, Route, Zap } from 'lucide-react'

import {

  Area,

  AreaChart,

  CartesianGrid,

  LabelList,

  ReferenceLine,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts'

import type { MetalRoutingDashboardMetrics } from '@/types/pdkMetalRouting'

import {

  buildImpedanceChartData,

  getImpedanceChartDomain,

  getImpedanceReferenceValue,

  topologyDisplayCount,

  topologyLaneOffsets,

} from '@/utils/metalRoutingMetricsVisual'

import { cn } from '@/utils/cn'



const VIZ_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }



type VizTone = 'blue' | 'green' | 'violet' | 'orange'



const toneLabelClass: Record<VizTone, string> = {

  blue: 'metal-routing-viz-card__label--blue',

  green: 'metal-routing-viz-card__label--green',

  violet: 'metal-routing-viz-card__label--violet',

  orange: 'metal-routing-viz-card__label--orange',

}



const toneIconClass: Record<VizTone, string> = {

  blue: 'metal-routing-viz-card__icon--blue',

  green: 'metal-routing-viz-card__icon--green',

  violet: 'metal-routing-viz-card__icon--violet',

  orange: 'metal-routing-viz-card__icon--orange',

}



function useAnimatedNumber(value: number, durationMs = 600, decimals = 0) {

  const [display, setDisplay] = useState(value)

  const prevRef = useRef(value)



  useEffect(() => {

    const start = prevRef.current

    const end = value

    const startTime = performance.now()



    function tick(now: number) {

      const progress = Math.min((now - startTime) / durationMs, 1)

      const eased = 1 - (1 - progress) ** 3

      const next = start + (end - start) * eased

      setDisplay(decimals > 0 ? next : Math.round(next))

      if (progress < 1) requestAnimationFrame(tick)

      else prevRef.current = end

    }



    requestAnimationFrame(tick)

  }, [value, durationMs, decimals])



  return display

}



function VizCard({

  className,

  children,

}: {

  className?: string

  children: ReactNode

}) {

  return (

    <article className={cn('metal-routing-viz-card', className)}>

      {children}

    </article>

  )

}



function VizCardHeader({

  tone,

  label,

  value,

  hint,

  icon,

}: {

  tone: VizTone

  label: string

  value: ReactNode

  hint: string

  icon: ReactNode

}) {

  return (

    <header className="metal-routing-viz-card__header">

      <div className="min-w-0">

        <p className={cn('metal-routing-viz-card__label', toneLabelClass[tone])}>{label}</p>

        <p className="metal-routing-viz-card__value">{value}</p>

        <p className="metal-routing-viz-card__hint">{hint}</p>

      </div>

      <span className={cn('metal-routing-viz-card__icon', toneIconClass[tone])} aria-hidden>

        {icon}

      </span>

    </header>

  )

}



function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {

  const animated = useAnimatedNumber(value, 600, decimals)

  const formatted =

    decimals > 0

      ? animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

      : animated.toLocaleString()

  return <motion.span layout>{formatted}</motion.span>

}



function RoutingTopologySchematic({ totalRoutes }: { totalRoutes: number }) {

  const displayCount = topologyDisplayCount(totalRoutes)

  const laneOffsets = useMemo(() => topologyLaneOffsets(displayCount), [displayCount])

  const height = 100

  const startX = 36

  const endX = 364

  const midX = 200



  return (

    <div className="metal-routing-topology-schematic" aria-hidden>

      <svg viewBox="0 0 400 100" className="metal-routing-topology-schematic__svg" preserveAspectRatio="xMidYMid meet">

        <circle cx={startX} cy={50} r="10" className="metal-routing-topology-schematic__port" />

        <circle cx={endX} cy={50} r="10" className="metal-routing-topology-schematic__port" />



        {totalRoutes === 0 ? (

          <>

            <path

              d={`M ${startX + 12} 42 L ${midX} 42 L ${midX} 30 L ${endX - 12} 30 L ${endX - 12} 50`}

              className="metal-routing-topology-schematic__lane metal-routing-topology-schematic__lane--idle"

            />

            <path

              d={`M ${startX + 12} 58 L ${midX} 58 L ${midX} 70 L ${endX - 12} 70 L ${endX - 12} 50`}

              className="metal-routing-topology-schematic__lane metal-routing-topology-schematic__lane--idle"

            />

          </>

        ) : null}



        <AnimatePresence initial={false}>

          {laneOffsets.map((offset, index) => {

            const y = 22 + offset * (height - 44)

            const elbow = index % 2 === 0 ? -14 : 14

            const path = `M ${startX + 12} ${y} L ${midX - 40} ${y} L ${midX - 40} ${y + elbow} L ${midX + 40} ${y + elbow} L ${midX + 40} ${y} L ${endX - 12} ${y}`



            return (

              <motion.g

                key={`lane-${index}-${displayCount}`}

                initial={{ opacity: 0 }}

                animate={{ opacity: 1 }}

                exit={{ opacity: 0 }}

                transition={VIZ_TRANSITION}

              >

                <motion.path

                  d={path}

                  className="metal-routing-topology-schematic__lane"

                  initial={{ pathLength: 0 }}

                  animate={{ pathLength: 1 }}

                  transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.08 }}

                />

                <motion.circle

                  r="4"

                  cy={y}

                  className="metal-routing-topology-schematic__pulse"

                  animate={{ cx: [startX + 20, endX - 20, startX + 20] }}

                  transition={{

                    duration: 7,

                    repeat: Infinity,

                    ease: 'linear',

                    delay: index * 0.85,

                  }}

                />

              </motion.g>

            )

          })}

        </AnimatePresence>

      </svg>

      {totalRoutes > displayCount ? (

        <p className="metal-routing-topology-schematic__more">+{totalRoutes - displayCount} more route blocks</p>

      ) : null}

    </div>

  )

}



function TotalRoutesCard({ totalRoutes, loading }: { totalRoutes: number; loading?: boolean }) {

  if (loading) {

    return <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--total" />

  }



  return (

    <VizCard className="metal-routing-viz-card--total">

      <VizCardHeader

        tone="blue"

        label="Total Routes"

        value={<AnimatedCounter value={totalRoutes} />}

        hint="Unique route blocks in system"

        icon={<Route className="h-5 w-5" />}

      />

      <RoutingTopologySchematic totalRoutes={totalRoutes} />

    </VizCard>

  )

}



function CompletedRoutesCard({

  completedRoutes,

  totalRoutes,

  loading,

}: {

  completedRoutes: number

  totalRoutes: number

  loading?: boolean

}) {

  const percent = totalRoutes > 0 ? Math.round((completedRoutes / totalRoutes) * 100) : 0

  const radius = 46

  const circumference = 2 * Math.PI * radius

  const offset = circumference - (percent / 100) * circumference

  const isComplete = totalRoutes > 0 && completedRoutes === totalRoutes



  if (loading) {

    return <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--completed" />

  }



  return (

    <VizCard className="metal-routing-viz-card--completed">

      <VizCardHeader

        tone="green"

        label="Completed Routes"

        value={

          <>

            <AnimatedCounter value={completedRoutes} /> / <AnimatedCounter value={totalRoutes} />

          </>

        }

        hint="Routes with full metal data & calculations"

        icon={<CheckCircle2 className="h-5 w-5" />}

      />

      <div className="metal-routing-donut-wrap">

        <svg viewBox="0 0 120 120" className="metal-routing-donut" role="img" aria-label={`${percent}% complete`}>

          <circle cx="60" cy="60" r={radius} className="metal-routing-donut__track" />

          <motion.circle

            cx="60"

            cy="60"

            r={radius}

            className={cn('metal-routing-donut__progress', isComplete && 'is-complete')}

            strokeDasharray={circumference}

            initial={false}

            animate={{ strokeDashoffset: offset }}

            transition={VIZ_TRANSITION}

            transform="rotate(-90 60 60)"

          />

        </svg>

        <div className="metal-routing-donut__center">

          <motion.span

            key={percent}

            className="metal-routing-donut__percent"

            initial={{ opacity: 0, scale: 0.92 }}

            animate={{ opacity: 1, scale: 1 }}

            transition={VIZ_TRANSITION}

          >

            {percent}%

          </motion.span>

          <span className="metal-routing-donut__sub">Completed</span>

        </div>

      </div>

    </VizCard>

  )

}



function ImpedanceValueLabel(props: { x?: number; y?: number; value?: number | string }) {
  const { x = 0, y = 0, value = 0 } = props
  const numeric = typeof value === 'number' ? value : Number(value)

  return (
    <g transform={`translate(${x}, ${y - 14})`}>
      <rect x={-26} y={-11} width={52} height={22} rx={6} className="metal-routing-impedance-badge" />
      <text x={0} y={4} textAnchor="middle" className="metal-routing-impedance-badge__text">
        {numeric.toFixed(2)} Ω
      </text>
    </g>
  )
}



function ImpedanceChartCard({

  metrics,

  loading,

}: {

  metrics: MetalRoutingDashboardMetrics

  loading?: boolean

}) {

  const gradId = useId().replace(/:/g, '')

  const chartData = useMemo(() => buildImpedanceChartData(metrics), [metrics])

  const yDomain = useMemo(() => getImpedanceChartDomain(metrics), [metrics])

  const referenceValue = useMemo(() => getImpedanceReferenceValue(metrics), [metrics])

  const animatedImpedance = useAnimatedNumber(metrics.totalRoutingImpedance, 700, 2)

  const lastIndex = Math.max(chartData.length - 1, 0)



  if (loading) {

    return <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--impedance" />

  }



  return (

    <VizCard className="metal-routing-viz-card--impedance">

      <div className="metal-routing-impedance-head">

        <span className="metal-routing-viz-card__icon metal-routing-viz-card__icon--violet" aria-hidden>

          <Zap className="h-5 w-5" />

        </span>

        <div className="min-w-0">

          <p className={cn('metal-routing-viz-card__label', toneLabelClass.violet)}>Total Routing Impedance</p>

          <p className="metal-routing-viz-card__value metal-routing-viz-card__value--violet">

            {animatedImpedance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ω

          </p>

          <p className="metal-routing-viz-card__hint">

            Σ route impedance

            {metrics.selectedProjectName ? ` · ${metrics.selectedProjectName}` : ''}

          </p>

        </div>

      </div>



      <div className="metal-routing-impedance-chart">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={chartData} margin={{ top: 18, right: 16, left: 0, bottom: 4 }}>

            <defs>

              <linearGradient id={`impedanceGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">

                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.38} />

                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.03} />

              </linearGradient>

            </defs>

            <CartesianGrid stroke="rgba(107, 114, 128, 0.1)" vertical={false} strokeDasharray="4 6" />

            <XAxis

              dataKey="segment"

              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}

              axisLine={false}

              tickLine={false}

              label={{

                value: 'Route Segments',

                position: 'insideBottom',

                offset: -2,

                fill: '#9ca3af',

                fontSize: 11,

              }}

            />

            <YAxis

              domain={yDomain}

              tick={{ fill: '#9ca3af', fontSize: 11 }}

              axisLine={false}

              tickLine={false}

              width={36}

              tickFormatter={(v: number) => v.toFixed(1)}

            />

            {referenceValue != null ? (

              <ReferenceLine

                y={referenceValue}

                stroke="#c4b5fd"

                strokeDasharray="5 5"

                strokeWidth={1.5}

              />

            ) : null}

            <Tooltip

              cursor={{ stroke: 'rgba(168, 85, 247, 0.28)', strokeWidth: 1 }}

              contentStyle={{

                borderRadius: 10,

                border: '1px solid #e5e7eb',

                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',

                fontSize: 12,

              }}

              formatter={(value: number) => [`${value.toFixed(2)} Ω`, 'Impedance']}

            />

            <Area

              type="monotone"

              dataKey="impedance"

              stroke="#a855f7"

              strokeWidth={2.5}

              fill={`url(#impedanceGrad-${gradId})`}

              animationDuration={300}

              dot={{ r: 3.5, fill: '#a855f7', stroke: '#fff', strokeWidth: 1.5 }}

              activeDot={{ r: 5, fill: '#7c3aed' }}

            >

              <LabelList

                dataKey="impedance"

                content={(props) => {
                  if (props.index !== lastIndex) return null
                  return (
                    <ImpedanceValueLabel x={props.x} y={props.y} value={props.value} />
                  )
                }}

              />

            </Area>

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </VizCard>

  )

}



function PendingInboxIllustration() {

  return (

    <svg viewBox="0 0 120 80" className="metal-routing-pending-illustration" aria-hidden>

      <rect x="18" y="28" width="84" height="44" rx="6" className="metal-routing-pending-illustration__tray" />

      <path d="M 30 28 L 60 48 L 90 28" className="metal-routing-pending-illustration__tray-lip" />

      <circle cx="88" cy="22" r="10" className="metal-routing-pending-illustration__clock" />

      <path d="M 88 22 L 88 17 M 88 22 L 92 24" className="metal-routing-pending-illustration__clock-hand" />

    </svg>

  )

}



function PendingRoutesCard({ pendingRoutes, loading }: { pendingRoutes: number; loading?: boolean }) {

  if (loading) {

    return <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--pending" />

  }



  return (

    <VizCard className="metal-routing-viz-card--pending">

      <VizCardHeader

        tone="orange"

        label="Pending Routes"

        value={<AnimatedCounter value={pendingRoutes} />}

        hint="Awaiting metal rows or calculations"

        icon={<Clock className="h-5 w-5" />}

      />



      {pendingRoutes === 0 ? (

        <motion.div

          className="metal-routing-pending-empty"

          initial={{ opacity: 0, y: 6 }}

          animate={{ opacity: 1, y: 0 }}

          transition={VIZ_TRANSITION}

        >

          <PendingInboxIllustration />

        </motion.div>

      ) : (

        <div className="metal-routing-pending-queue">

          <p className="metal-routing-pending-queue__title">

            <AnimatedCounter value={pendingRoutes} /> Pending Job{pendingRoutes === 1 ? '' : 's'}

          </p>

          <ul className="metal-routing-pending-queue__list">

            <AnimatePresence initial={false}>

              {Array.from({ length: Math.min(pendingRoutes, 4) }, (_, i) => (

                <motion.li

                  key={`pending-${pendingRoutes}-${i}`}

                  className="metal-routing-pending-queue__item"

                  initial={{ opacity: 0, x: -10 }}

                  animate={{ opacity: 1, x: 0 }}

                  exit={{ opacity: 0, x: 10 }}

                  transition={{ ...VIZ_TRANSITION, delay: i * 0.05 }}

                >

                  <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden />

                  <span>Route block awaiting completion</span>

                  <span className="metal-routing-pending-queue__bar" />

                </motion.li>

              ))}

            </AnimatePresence>

          </ul>

          {pendingRoutes > 4 ? (

            <p className="metal-routing-pending-queue__more">+{pendingRoutes - 4} more in queue</p>

          ) : null}

        </div>

      )}

    </VizCard>

  )

}



export function MetalRoutingDashboardVisuals({

  metrics,

  loading,

}: {

  metrics: MetalRoutingDashboardMetrics | null

  loading?: boolean

}) {

  const data: MetalRoutingDashboardMetrics = metrics ?? {

    totalRoutes: 0,

    completedRoutes: 0,

    pendingRoutes: 0,

    totalRoutingImpedance: 0,

    selectedProjectId: null,

    selectedProjectName: null,

  }



  return (

    <section className="metal-routing-metrics-viz" aria-label="Routing metrics visualizations">

      <TotalRoutesCard totalRoutes={data.totalRoutes} loading={loading} />

      <CompletedRoutesCard

        completedRoutes={data.completedRoutes}

        totalRoutes={data.totalRoutes}

        loading={loading}

      />

      <ImpedanceChartCard metrics={data} loading={loading} />

      <PendingRoutesCard pendingRoutes={data.pendingRoutes} loading={loading} />

    </section>

  )

}


