/**
 * Domain-specific error types.
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = "This prompt doesn't exist or has expired.") {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = "Invalid input") {
    super(message, 422);
  }
}

class RateLimitError extends AppError {
  constructor(windowMs) {
    const minutes = Math.ceil(windowMs / 60000);
    super(
      `You've hit the rate limit. Please try again in ${minutes} minutes.`,
      429
    );
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError,
  ValidationError,
  RateLimitError,
};
