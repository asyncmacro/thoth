export interface LogContext {
  requestId?: string;
  vaultId?: string;
  revision?: number;
}

export function createLogger(env: { ENVIRONMENT?: string }) {
  const isDev =
    env.ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development';

  return {
    info: (message: string, ctx?: LogContext) => {
      if (isDev) {
        console.log(JSON.stringify({ level: 'info', message, ...ctx }));
      }
    },
    error: (message: string, ctx?: LogContext, error?: unknown) => {
      console.error(
        JSON.stringify({
          level: 'error',
          message,
          ...ctx,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: isDev ? error.stack : undefined,
                }
              : error,
        })
      );
    },
  };
}
