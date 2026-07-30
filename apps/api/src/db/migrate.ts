import { setDeployStatus } from '@api/modules/status/service'
import { redis } from 'bun'
import { db, sql } from './client'

export const dbAction = async () => {
  console.log('⌛ Running database migration check...')

  const [dbOk, dbError] = await db.execute(sql`SELECT 1`).then(
    () => [true, null] as const,
    (e: unknown) => [false, e] as const,
  )

  if (!dbOk) {
    setDeployStatus('error')
    console.error('❌ Database connection test failed:', dbError)
    return
  }

  console.log('✅ Database connection test successful')
  setDeployStatus('ready')

  try {
    const pong = await redis.ping()
    if (pong === 'PONG') {
      console.log('✅ Redis connection test successful')
    } else {
      console.warn(
        '⚠️  Redis ping returned unexpected response — continuing without cache/locks',
      )
    }
  } catch (e) {
    console.warn(
      '⚠️  Redis unavailable — continuing without cache/locks:',
      e instanceof Error ? e.message : String(e),
    )
  }

  console.log('🎉 Database loading complete')
}
