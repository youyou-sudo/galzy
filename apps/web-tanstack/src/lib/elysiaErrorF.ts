export const elysiaErrorF = (error: any) => {
  if (error) {
    switch (error.status) {
      case 400:
      case 401:
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
