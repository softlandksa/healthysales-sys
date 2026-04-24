export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = "غير مصرح لك بالدخول") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = "ليس لديك صلاحية تنفيذ هذا الإجراء") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = "العنصر المطلوب غير موجود") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly statusCode = 422;
  constructor(message = "بيانات غير صالحة") {
    super(message);
    this.name = "ValidationError";
  }
}
