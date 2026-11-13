/** A data source couldn't answer. Pages show a friendly message instead. */
export class DataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceError";
  }
}
