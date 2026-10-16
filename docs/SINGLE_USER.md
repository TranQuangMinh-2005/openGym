# Local single-user development

Set `SINGLE_USER=1` in `.env`, then run `docker compose up -d --build`.
The local Compose override builds this fork and exposes the web app at
`http://localhost:8080` on this machine only.

Opening the app enters one persistent server profile without a login. A fresh
instance creates an admin profile; an instance with one profile reuses it and
its training data. With multiple profiles, set `SINGLE_USER_ID` to the desired
existing profile ID. Settings hides sign-in, device pairing and sign-out controls.
All browsers accessing this instance share that profile and its permissions.

Data remains under `data/`. To restore normal authentication, set
`SINGLE_USER=0` and run `docker compose up -d`. Existing registered profiles keep
their login methods; new profiles created in single-user mode have no login credentials.
