export function EmployeePageLoading() {
  return (
    <div className="emp-page-loading" aria-busy="true" aria-label="Loading page">
      <div className="emp-page-loading__inner">
        <div className="emp-page-loading__bar emp-page-loading__bar--title" />
        <div className="emp-page-loading__bar emp-page-loading__bar--subtitle" />
        <div className="emp-page-loading__card">
          <div className="emp-page-loading__bar emp-page-loading__bar--line" />
          <div className="emp-page-loading__bar emp-page-loading__bar--line emp-page-loading__bar--short" />
          <div className="emp-page-loading__bar emp-page-loading__bar--line" />
        </div>
        <div className="emp-page-loading__row">
          <div className="emp-page-loading__card emp-page-loading__card--half" />
          <div className="emp-page-loading__card emp-page-loading__card--half" />
        </div>
      </div>
    </div>
  )
}
