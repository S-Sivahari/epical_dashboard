import { useParams } from 'react-router-dom'
import { EmployeeProjectBoardPage } from '@components/employee/projects/EmployeeProjectBoardPage'

export default function EmployeeProjectWorkspace() {
  const { projectId = '' } = useParams()
  return <EmployeeProjectBoardPage routeProjectId={projectId} />
}
