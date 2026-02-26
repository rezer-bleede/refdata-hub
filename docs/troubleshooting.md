# Troubleshooting the Reviewer UI

When the Reviewer UI displays a toast such as:

> Unable to load configuration and canonical library from the API. Confirm the backend service is running.

follow these steps to diagnose and resolve the issue.

## Cloudflare Pages + Functions specific checks

When deployed on Cloudflare Pages, verify the following first:

1. **SPA deep links** resolve correctly
   - Confirm `reviewer-ui/public/_redirects` contains `/* /index.html 200`
   - Reload `/settings` directly; it should not return a 404 page

2. **Same-origin API path** is active
   - In hosted environments, `VITE_API_BASE_URL` should be `/api`
   - If unset, the UI now falls back to same-origin `/api` on non-localhost domains

3. **Pages Functions env vars** are set
   - `COMPANION_API_BASE_URL`
   - `COMPANION_API_TOKEN` (secret)
   - optional timeout/retry/circuit-breaker values

4. **Companion service reachability**
   - If companion calls fail repeatedly, the API opens a temporary circuit breaker and returns `503`
   - Wait for cooldown or restore companion availability

5. **Database binding**
   - Prefer Hyperdrive binding `HYPERDRIVE`
   - If Hyperdrive is not configured, set `DATABASE_URL` for fallback

## 1. Confirm the browser can reach the API

The UI now logs the resolved API base URL during requests. Open the browser developer tools and check the **Console** tab for debug entries such as:

```
[api] GET http://localhost:8000/api/config
```

If the host portion of the URL is anything other than `http://localhost:8000`, update the deployment configuration to point at a browser-accessible address. The bundled Docker Compose file already passes `VITE_API_BASE_URL=http://localhost:8000`, which keeps the UI and API aligned when running the stack locally.

## 2. Inspect backend logs

The FastAPI service now emits structured log entries when seeding configuration data or serving configuration requests:

```
INFO api.app.services.config System configuration record missing; seeding defaults
DEBUG api.app.routes.config Configuration retrieved {'config_id': 1}
```

These messages confirm the configuration row exists and is returned to the UI. If the API logs show errors, restart the service and ensure the database is reachable.

## 3. Validate credentials with the Test connection action

The Source Connections page now includes a **Test connection** button next to the save action. Use it to confirm new or updated
credentials before committing them to the catalog. The Reviewer UI will display a toast with the outcome and measured latency, and
the API logs an audit-friendly entry if the connection attempt fails. If the test reports an error, adjust the host, port, or
options JSON without leaving the modal until it succeeds.

## 4. Review canonical library availability

Requests to `/api/reference/canonical` log the number of values returned. If the log shows `count: 0`, reseed the database or add canonical entries through the UI. A zero-length response will not trigger the toast, but the debug output can help verify the request succeeded.

Bulk imports now produce structured log entries that call out the uploaded filename, detected headers, and any blocking
validation issues. Look for messages such as `Bulk canonical import received` and `Bulk import aborted: missing canonical label
column` to confirm whether the parser recognised the provided headers (including aliases like `Canonical Value` or `Long
Description`). These logs make it easier to align the spreadsheet headers with the expected schema.

## 5. Retry with a hard refresh

After addressing connectivity issues, perform a hard refresh (`Ctrl` + `Shift` + `R` on most browsers) to clear cached bundles and re-run the initial data fetch. The enhanced UI logging will confirm whether configuration and canonical data load successfully on subsequent attempts.

## 6. Resolve `canonicalvalue.attributes` missing column errors

Deployments created before the JSON `attributes` column was added to the `canonicalvalue` table can surface the following stack trace during API startup:

```
sqlalchemy.exc.ProgrammingError: (psycopg.errors.UndefinedColumn) column canonicalvalue.attributes does not exist
```

The backend now self-heals this legacy schema automatically by adding the column and backfilling existing rows with an empty JSON object. Restart the API container (or rerun `docker compose up --build`) to apply the fix. Once the service is back online, the Reviewer UI will be able to load canonical values and the error will no longer appear in the logs.

## 7. Resolve TypeScript build failures around mocked props

When running `npm run build` locally or inside the Docker image, you may encounter errors similar to:

```
Type 'Mock<(choice: ThemeChoice) => void, any>' is not assignable to type '(choice: ThemeChoice) => void'
```

Vitest's `vi.fn()` helper returns a mock object rather than a plain function, which causes TypeScript to reject it as a valid prop value. The fix is to wrap the mock inside a thin inline callback and assert against the underlying mock instead of the prop itself. The updated `createProps` factory in `reviewer-ui/src/App.test.tsx` follows this approach:

```ts
const onThemeChange = vi.fn();

const props = {
  onThemeChange: (choice: ThemeChoice) => onThemeChange(choice),
  // ...other props
};

expect(onThemeChange).toHaveBeenCalledWith('light');
```

This preserves full access to Vitest's assertion helpers while ensuring the JSX props satisfy the strict component typings.

## 8. Resolve TypeScript textarea typing errors in the Reviewer UI

If `npm run build` fails with errors like:

```
Type 'ChangeEventHandler<HTMLInputElement>' is not assignable to type 'ChangeEventHandler<HTMLTextAreaElement>'
```

ensure that multiline fields are rendered through the shared `Form.Control` primitive using `as="textarea"` and that the component
accepts textarea-specific props. The current implementation in `reviewer-ui/src/components/ui.tsx` narrows props based on the
`as` value, so `onChange`, `rows`, and related attributes are correctly typed. After updating, rerun `npm run build` to confirm
the frontend bundle succeeds.
