export class ApiServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiServerError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export class PostMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostMessageError';
  }
}
