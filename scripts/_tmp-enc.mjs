import { open } from 'shapefile'
const clean = (v) => (typeof v === 'string' ? v.replace(/\0/g, '').trim() : v)
const src = await open('data/geo/admin1/ne_50m_admin_1_states_provinces.shp',
                       'data/geo/admin1/ne_50m_admin_1_states_provinces.dbf', { encoding: 'utf8' })
for (let r = await src.read(); !r.done; r = await src.read()) {
  const p = r.value.properties
  const iso = clean(p.adm0_a3)
  if (!['CHN', 'IND'].includes(iso)) continue
  if (clean(p.region)) continue
  console.log(`${iso}  ${clean(p.adm1_code)}  ${clean(p.name)}  (${clean(p.type_en)})`)
}
