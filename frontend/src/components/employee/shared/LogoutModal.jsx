import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { Button } from '@components/employee/ui/button'
import { useUIStore } from '@store/employee/uiStore'
import { useAuthStore } from '@store/authStore'
import { useNavigate } from 'react-router-dom'

export function LogoutModal() {
  const { logoutModalOpen, setLogoutModalOpen } = useUIStore()
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    void logout()
    setLogoutModalOpen(false)
    navigate('/auth/login')
  }

  return (
    <Dialog open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>
            Are you sure you want to sign out of the employee portal?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setLogoutModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
