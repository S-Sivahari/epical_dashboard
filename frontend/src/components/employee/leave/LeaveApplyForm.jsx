import { Controller } from 'react-hook-form'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DateInput } from '@components/shared/DateInput'
import { LeaveFormAlerts } from './LeaveFormAlerts'

const CARD_CLASS = portalCardClass({ className: 'emp-leave-card' })

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger">{message}</p>
}

function FormField({ label, htmlFor, required, children, error, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? ' *' : ''}
      </Label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

export function LeaveApplyForm({
  onSubmit,
  control,
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
  leaveBounds,
  availableLeaveTypes,
  leaveDurations,
  halfDaySessions,
  showLopNotice,
  selectedLeaveType,
  casualBalanceRemaining,
  earnedBalanceRemaining,
  sickBalanceRemaining,
  requestedWorkingDays,
  isCasualSameDay,
  holidayWarning,
}) {
  const leaveDuration = watch('leaveDuration')

  return (
    <InteractiveCard
      as="form"
      selectable={false}
      onSubmit={onSubmit}
      className={cn(
        CARD_CLASS,
        'emp-leave-apply-card emp-leave-top-panel flex w-full min-h-0 flex-col',
      )}
    >
      <div className="emp-leave-apply-head">
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Apply for leave
        </h3>
      </div>

      <div className="emp-leave-form-grid">
        <FormField label="Leave Type" required error={errors.type?.message}>
          <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
            <SelectTrigger className="emp-leave-control mt-1.5">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {availableLeaveTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Leave Duration" required error={errors.leaveDuration?.message}>
          <Select value={watch('leaveDuration')} onValueChange={(v) => setValue('leaveDuration', v)}>
            <SelectTrigger className="emp-leave-control mt-1.5">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {leaveDurations.map((duration) => (
                <SelectItem key={duration} value={duration}>
                  {duration}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="From Date" required>
          <Controller
            name="fromDate"
            control={control}
            render={({ field }) => (
              <DateInput
                className="emp-leave-control mt-1.5 rounded-xl"
                value={field.value || ''}
                onChange={field.onChange}
                minDate={leaveBounds.min}
                maxDate={leaveBounds.max}
                error={errors.fromDate?.message}
              />
            )}
          />
        </FormField>

        <FormField label="To Date" required>
          <Controller
            name="toDate"
            control={control}
            render={({ field }) => (
              <DateInput
                className="emp-leave-control mt-1.5 rounded-xl"
                value={field.value || ''}
                onChange={field.onChange}
                minDate={leaveBounds.min}
                maxDate={leaveBounds.max}
                disabled={leaveDuration === 'Half Day'}
                error={errors.toDate?.message}
              />
            )}
          />
        </FormField>

        {leaveDuration === 'Half Day' ? (
          <FormField
            label="Half-day Session"
            required
            error={errors.halfDaySession?.message}
            className="emp-leave-form-grid__full"
          >
            <Select value={watch('halfDaySession')} onValueChange={(v) => setValue('halfDaySession', v)}>
              <SelectTrigger className="emp-leave-control mt-1.5">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {halfDaySessions.map((session) => (
                  <SelectItem key={session} value={session}>
                    {session}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}

        <FormField
          label="Reason for leave"
          htmlFor="leave-reason"
          required
          error={errors.reason?.message}
          className="emp-leave-form-grid__full"
        >
          <Textarea
            id="leave-reason"
            rows={3}
            placeholder="Briefly explain why you are requesting leave…"
            className="mt-1.5 min-h-[4.5rem] resize-y rounded-xl border-border bg-white"
            {...register('reason')}
          />
        </FormField>
      </div>

      <LeaveFormAlerts
        showLopNotice={showLopNotice}
        selectedLeaveType={selectedLeaveType}
        casualBalanceRemaining={casualBalanceRemaining}
        earnedBalanceRemaining={earnedBalanceRemaining}
        sickBalanceRemaining={sickBalanceRemaining}
        requestedWorkingDays={requestedWorkingDays}
        isCasualSameDay={isCasualSameDay}
        holidayWarning={holidayWarning}
      />

      <div className="mt-4 shrink-0">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="emp-dash-btn emp-dash-btn--wide emp-portal-submit-btn w-full"
        >
          <span className="emp-dash-btn__label">
            {isSubmitting ? 'Submitting…' : 'Submit Request'}
          </span>
        </Button>
      </div>
    </InteractiveCard>
  )
}
