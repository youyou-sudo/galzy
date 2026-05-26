export const elysiaErrorF = (error: any) => {
  if (error) {
    switch (error.status) {
      case 400:
      case 401:
        throw new Error(error.value)

      case 500:
      case 502:
        throw new Error(error.value)

      default:
        throw new Error(error.value)
    }
  }
}
