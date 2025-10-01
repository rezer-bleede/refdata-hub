# Troubleshooting the Reviewer UI

When the Reviewer UI displays a toast such as:

> Unable to load configuration and canonical library from the API. Confirm the backend service is running.

follow these steps to diagnose and resolve the issue.

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

## 3. Review canonical library availability

Requests to `/api/reference/canonical` log the number of values returned. If the log shows `count: 0`, reseed the database or add canonical entries through the UI. A zero-length response will not trigger the toast, but the debug output can help verify the request succeeded.

## 4. Retry with a hard refresh

After addressing connectivity issues, perform a hard refresh (`Ctrl` + `Shift` + `R` on most browsers) to clear cached bundles and re-run the initial data fetch. The enhanced UI logging will confirm whether configuration and canonical data load successfully on subsequent attempts.
