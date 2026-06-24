import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function request(method, urlPath, { body, headers = {}, cookies = '' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ?? null
    const reqHeaders = { Cookie: cookies, ...headers }
    if (payload && !reqHeaders['Content-Length']) {
      reqHeaders['Content-Length'] = Buffer.isBuffer(payload)
        ? payload.length
        : Buffer.byteLength(payload)
    }
    const req = http.request(
      { hostname: 'localhost', port: 3000, path: `/api${urlPath}`, method, headers: reqHeaders },
      (res) => {
        let chunks = ''
        res.on('data', (d) => {
          chunks += d
        })
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: chunks })
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const login = await request('POST', '/auth/login', {
  body: JSON.stringify({ email: 'admin@company.com', password: 'admin123', portal: 'admin' }),
  headers: { 'Content-Type': 'application/json' },
})
const setCookie = login.headers['set-cookie'] ?? []
const cookies = setCookie.map((c) => c.split(';')[0]).join('; ')
const csrfCookie = setCookie.find((c) => c.includes('hrms_csrf'))
const csrfVal = csrfCookie
  ? decodeURIComponent(csrfCookie.split('=')[1].split(';')[0])
  : ''

const list1 = await request('GET', '/company-achievements?page=1&limit=12', {
  cookies,
  headers: { 'X-CSRF-Token': csrfVal },
})
console.log('list before', list1.status, list1.body.slice(0, 400))

// 1x1 png
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
const boundary = '----imgtest'
const fields = {
  title: 'Image Test',
  description: 'Has png image',
  category: 'Innovation',
  employeeOrTeamName: 'Team',
  achievementDate: '2026-06-19',
  tags: 'img',
}
let head = ''
for (const [k, v] of Object.entries(fields)) {
  head += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
}
head += `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`
const body = Buffer.concat([Buffer.from(head, 'utf8'), png, Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')])

const create = await request('POST', '/company-achievements', {
  body,
  cookies,
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'X-CSRF-Token': csrfVal,
  },
})
console.log('create', create.status, create.body)

let createdId = null
let hasImage = false
try {
  const parsed = JSON.parse(create.body)
  createdId = parsed.id
  hasImage = parsed.hasImage
} catch {}

const list2 = await request('GET', '/company-achievements?page=1&limit=12', {
  cookies,
  headers: { 'X-CSRF-Token': csrfVal },
})
console.log('list after', list2.status, list2.body.slice(0, 400))

if (createdId && hasImage) {
  const img = await request('GET', `/company-achievements/${createdId}/image`, {
    cookies,
    headers: { 'X-CSRF-Token': csrfVal },
  })
  console.log('image fetch', img.status, 'len', img.body.length)
}
