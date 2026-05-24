import { setDeployStatus } from '@api/modules/status/service'
import { redis } from 'bun'
import { dbFdw } from './fdw'
import { dbSeed } from './seed'
import { vndbDb } from './vndb'
import { db, sql } from './webData'

export const dbAction = async () => {
  console.log('⌛ Running database migrations and seeding...')

  const [dbConn, vndbConn] = await Promise.allSettled([
    checkDbConnection(db),
    checkDbConnection(vndbDb),
  ])

  const dbOk = dbConn.status === 'fulfilled' && dbConn.value
  const vndbOk = vndbConn.status === 'fulfilled' && vndbConn.value

  if (dbOk) {
    console.log('✅️ Website database connection test successful')
  } else {
    setDeployStatus('error')
    console.error('❌ Website database connection test failed', dbConn)
  }

  if (vndbOk) {
    console.log('✅️ VNDB database connection test successful')
  } else {
    setDeployStatus('error')
    console.error('❌ VNDB database connection test failed', vndbConn)
  }

  if (!dbOk || !vndbOk) return

  setDeployStatus('migrating')

  const [seedRes, fdwRes, redisRes] = await Promise.allSettled([
    dbSeed(),
    dbFdw(),
    (async () => {
      const pong = await redis.ping()
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed')
      }
      return pong
    })(),
  ])

  if (seedRes.status === 'fulfilled') {
    console.log('✅️ Database seed completed')
  } else {
    setDeployStatus('error')
    console.error('❌ Error during database setup:', seedRes.reason)
  }

  if (fdwRes.status === 'fulfilled') {
    console.log('✅️ dbFdw connection test successful')
  } else {
    setDeployStatus('error')
    console.error('❌ Error during FDW setup:', fdwRes.reason)
  }

  if (redisRes.status === 'fulfilled') {
    console.log('✅️ Redis connection test successful')
  } else {
    setDeployStatus('error')
    console.error('❌ Redis connection test failed:', redisRes.reason)
  }

  setDeployStatus('ready')
  console.log('🎉 Database loading complete')
}

const checkDbConnection = async (db: any) => {
  try {
    await sql`SELECT 1`.execute(db)
    return true
  } catch {
    return false
  }
}
