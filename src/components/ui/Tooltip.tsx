import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export function UiTooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
            {content}
            <Tooltip.Arrow className="fill-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
