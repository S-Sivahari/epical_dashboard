import type { ReactNode } from 'react'
import type { MetalRoutingColumnHeader } from '@/constants/metalRoutingTableHeaders'

/** SI unit text where m / µ must stay lowercase under header uppercase styling. */
export function MetalRoutingColumnUnit({ text }: { text: string }) {
  const nodes: ReactNode[] = []

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === 'm' || char === 'µ') {
      nodes.push(
        <span key={`${index}-${char}`} className="metal-routing-col-unit__prefix">
          {char}
        </span>,
      )
    } else {
      nodes.push(char)
    }
  }

  return <>{nodes}</>
}

export function MetalRoutingColumnHeaderCell({ header }: { header: MetalRoutingColumnHeader }) {
  return (
    <>
      <span className="metal-routing-col-label">{header.label}</span>
      {header.unit ? (
        <span className="metal-routing-col-unit">
          <MetalRoutingColumnUnit text={header.unit} />
        </span>
      ) : null}
    </>
  )
}
