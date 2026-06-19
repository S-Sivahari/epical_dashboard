/** Decorative nested scales on colorful PDK / project list rows */
export function PdkListRowScales() {
  return (
    <span className="metal-routing-pdk-list-row__scales" aria-hidden>
      <span className="metal-routing-pdk-list-row__scales-wash" />
      <span className="metal-routing-pdk-list-row__scale metal-routing-pdk-list-row__scale--4" />
      <span className="metal-routing-pdk-list-row__scale metal-routing-pdk-list-row__scale--3" />
      <span className="metal-routing-pdk-list-row__scale metal-routing-pdk-list-row__scale--2" />
      <span className="metal-routing-pdk-list-row__scale metal-routing-pdk-list-row__scale--1" />
      <span className="metal-routing-pdk-list-row__scale-hub" />
    </span>
  )
}
