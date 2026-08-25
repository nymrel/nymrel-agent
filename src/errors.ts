export class NymrelError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: readonly string[];

  public constructor(code: string, message: string, status = 400, details: readonly string[] = []) {
    super(message);
    this.name = "NymrelError";
    this.code = code;
    this.status = status;
    this.details = [...details];
  }
}

export function publicError(error: unknown): NymrelError {
  if (error instanceof NymrelError) return error;
  return new NymrelError("internal_error", "The request could not be completed.", 500);
}
