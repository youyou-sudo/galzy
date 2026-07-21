import { setDeployStatus } from '@api/modules/status/service'
import { db, sql } from './client'
import { redis } from 'bun'

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

  redis.ping().then((pong) => {
    if (pong === 'PONG') {
      console.log('✅ Redis connection test successful')
    } else {
      setDeployStatus('error')
      console.error('❌ Redis connection test failed')
    }
  }).catch((e) => {
    setDeployStatus('error')
    console.error('❌ Redis connection test failed:', e)
  })

  console.log('🎉 Database loading complete')
}
