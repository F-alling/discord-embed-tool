import { HttpError } from 'flaska'

export class HttpErrorInternal extends HttpError {
  constructor(message, inner, extra) {
    super(500, message);

    Error.captureStackTrace(this, HttpError);

    let proto = Object.getPrototypeOf(this);
    proto.name = 'HttpErrorInternal';

    this.inner = inner
    this.extra = extra
  }
}