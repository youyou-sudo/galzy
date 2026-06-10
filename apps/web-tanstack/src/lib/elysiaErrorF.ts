import { redirect } from '@tanstack/react-router'

export const elysiaErrorF = (error: any) => {
  if (error) {
    switch (error.status) {
      case 400:
      case 401:
        throw redirect({
          to: '/auth/login',
        })
      case 403:
        throw {
          status: error.status,
          message: error.value,
        }
      case 429:
        throw {
          status: error.status,
          message: error.value,
        }

      case 500:
      case 502:
        throw {
          status: error.status,
          message: error.value,
        }

      default:
        throw {
          status: error.status ?? 500,
          message: error.value ?? 'Unknown error',
        }
    }
  }
}
