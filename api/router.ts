import { createRouter, publicQuery } from "./middleware";
import { libraryRouter } from "./routers/library";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  library: libraryRouter,
});

export type AppRouter = typeof appRouter;
