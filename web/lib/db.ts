import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.POSTGRES_URL!)

export function generateInviteCode(prefix: string = 'BW') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}-${code}`
}
