export type ServiceErrorCode =
  | "validation_error"
  | "not_found"
  | "unauthorized"
  | "conflict"
  | "unexpected_error";

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
};

export type ServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ServiceError;
    };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function err(code: ServiceErrorCode, message: string): ServiceResult<never> {
  return {
    ok: false,
    error: { code, message },
  };
}
