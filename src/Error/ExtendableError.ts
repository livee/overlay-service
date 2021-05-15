class ExtendableError extends Error {
    public constructor(message: string, cause?: Error) {
        super(message);

        this.name = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);

        if (cause && cause.stack) {
            this.stack = `${this.stack}\n\nCause: ${cause.stack}`;
        }
    }
}

export { ExtendableError };
