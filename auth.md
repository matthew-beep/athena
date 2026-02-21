# Auth — How It Works

Single-user JWT authentication. No registration flow — the only account is `admin`, which is created automatically on backend startup.

---

## Backend

### Admin account seeding (`main.py`)

On every startup, the lifespan handler calls `seed_admin_user()`. It checks whether a row with `username = 'admin'` exists in the `users` table. If not, it bcrypt-hashes `SEED_ADMIN_PASSWORD` (default: `athena`) and inserts the row. If the user already exists, it does nothing. This runs once per container start, before any requests are served.

```python
# main.py — lifespan
await seed_admin_user()
```

### Password hashing (`core/security.py`)

Passwords are hashed with bcrypt via the `bcrypt` library directly (not passlib). `bcrypt.gensalt()` generates a new salt each time, so two hashes of the same password will differ.

```python
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

The raw password is never stored anywhere.

### Login endpoint (`api/auth.py` → `POST /api/auth/login`)

1. Looks up the user by username in Postgres.
2. If not found, or if bcrypt verification fails → `401 Unauthorized`.
3. If valid → calls `create_access_token({"sub": username})` and returns the token.

The response body is:
```json
{ "access_token": "<token>", "token_type": "bearer" }
```

No cookies. No refresh tokens. Token lives in the client.

### JWT structure (`core/security.py`)

| Setting | Value | Source |
|---------|-------|--------|
| Algorithm | HS256 | `jwt_algorithm` in config |
| Secret | `JWT_SECRET_KEY` env var | Required — change from default |
| Expiry | 7 days from issue time | `jwt_expire_days` in config |
| Subject claim (`sub`) | `username` (string) | Set at login |

`create_access_token` adds an `exp` claim (UTC timestamp) to whatever payload dict is passed in, then signs with `python-jose`.

```python
def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
```

### Token verification — the `get_current_user` dependency

Every protected route declares `Depends(get_current_user)`. FastAPI calls this before the handler runs.

What it does:
1. Extracts the `Authorization: Bearer <token>` header via `HTTPBearer()`. If the header is missing or malformed, FastAPI returns `403` before this code even runs.
2. Calls `decode_token()`, which uses `jwt.decode()`. If the token is expired or the signature is wrong, `JWTError` is raised and converted to `401`.
3. Pulls `sub` from the payload. If missing → `401`.
4. Queries Postgres for the user by username. If not found (e.g. account deleted after token was issued) → `401`.
5. Returns the user dict `{ id, username, created_at }` to the handler.

```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    payload = decode_token(credentials.credentials)
    username = payload.get("sub")
    ...
    user = await postgres.fetch_one("SELECT id, username, created_at FROM users WHERE username = $1", username)
    return dict(user)
```

### `GET /api/auth/me`

Returns the current user object. Used by the frontend immediately after login to get the user id and username to store locally.

```json
{ "id": 1, "username": "admin", "created_at": "2026-02-20T10:00:00Z" }
```

### What is and isn't protected

- `POST /api/auth/login` — public (no token required, obviously)
- `GET /api/system/health` — public (used by Docker healthcheck)
- Everything else — requires `Authorization: Bearer <token>` header

---

## Frontend

### Zustand auth store (`stores/auth.store.ts`)

Holds `token`, `user`, and `isAuthenticated`. Persisted to `localStorage` under the key `athena-auth`. Only `token` and `user` are written to storage — `isAuthenticated` is derived on rehydration.

On page reload, Zustand's `persist` middleware reads `athena-auth` from localStorage. The `onRehydrateStorage` callback runs and sets `isAuthenticated: true` if a token is present. No server round-trip on reload — the user is considered logged in immediately if a token exists in storage.

```typescript
onRehydrateStorage: () => (state) => {
  if (state?.token) {
    state.isAuthenticated = true;
  }
}
```

Note: this trusts the token without validating expiry client-side. If the token has expired, the first API call will get a `401` and trigger logout automatically (see below).

### Login flow

1. `LoginPage` posts `{ username, password }` to `POST /api/auth/login` via a plain `fetch` (not `apiClient` — the store isn't populated yet).
2. Gets back `{ access_token, token_type }`.
3. Immediately fetches `GET /api/auth/me` with `Authorization: Bearer <token>` to get the user object.
4. Calls `setAuth(token, user)` on the store → persisted to localStorage → `isAuthenticated` becomes `true` → router navigates to `/`.

### Sending the token on every request (`api/client.ts`)

`apiClient` reads the token from the store synchronously via `useAuthStore.getState().token` (not a hook — safe to call outside React components) and injects it as a header on every request.

```typescript
function getHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}
```

### Automatic logout on 401

`handleResponse` in `apiClient` checks every response status. If it's `401`, it calls `logout()` on the store (clears token, user, isAuthenticated from state and localStorage) and throws. The `ProtectedRoute` wrapper in the app detects `isAuthenticated: false` and redirects to `/login`.

```typescript
if (res.status === 401) {
  useAuthStore.getState().logout();
  throw new Error('Unauthorized');
}
```

This covers both expired tokens and any future case where the backend revokes access.

### SSE streaming requests

The regular `apiClient.postStream()` method also injects the Bearer token — it just bypasses `handleResponse` because the response body is a stream. The 401 check doesn't apply there (a 401 on a stream start would surface as a failed fetch).

---

## Token lifecycle

```
Login
  │
  └─► POST /api/auth/login
        │
        └─► bcrypt verify → jwt.encode(sub=username, exp=now+7d)
              │
              └─► { access_token } returned to client
                    │
                    └─► stored in localStorage (athena-auth)
                          │
                          └─► sent as Authorization: Bearer on every request
                                │
                                ├─► backend decodes → verifies exp → DB lookup → handler
                                │
                                └─► if expired or invalid → 401 → client logout()
```

Token expiry is 7 days. There is no refresh mechanism — once expired, the user must log in again.

---

## Config reference

All values read from environment variables via `config.py` (Pydantic Settings):

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET_KEY` | `supersecretkey-change-in-production` | **Must be changed.** Any leak allows token forgery. |
| `SEED_ADMIN_PASSWORD` | `athena` | Password for the auto-created admin account. Change before first run. |

The algorithm (`HS256`) and expiry (7 days) are hardcoded in `config.py` but can be overridden via env vars `JWT_ALGORITHM` and `JWT_EXPIRE_DAYS` if needed.
