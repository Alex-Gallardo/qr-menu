// Solo lo que usa el navegador: así el bundler descarta Replay, Feedback y tracing.
export { captureException, init } from "@sentry/nextjs";
