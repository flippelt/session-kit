export class KitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KitError'
  }
}
