/** Un error que se enseña tal cual a quien hace el estudio. */
export class StudyError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "StudyError";
  }
}
