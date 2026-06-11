import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { PdkModulesPage } from '@pages/shared/pdk/PdkModulesPage'

export function SignalAnalysisPdkModulesPage({ basePath }: { basePath: string }) {
  const navigate = useNavigate()

  return (
    <MetalRoutingPageShell fill bleed className="metal-routing-pdk-modules-shell">
      <div className="metal-routing-pdk-modules-embedded-layout">
        <div className="metal-routing-pdk-modules-embedded-back">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(basePath)}
          >
            Back to projects
          </Button>
        </div>
        <PdkModulesPage embedded />
      </div>
    </MetalRoutingPageShell>
  )
}
