# Wholesome Haven Tours

Private tour booking and staff desk for [Wholesome Haven Senior Living](https://wholesomehavensd.com).

- Families: https://tours.wholesomehavensd.com
- Staff desk: https://tours.wholesomehavensd.com/admin

## Railway

1. New project → Deploy from this GitHub repo
2. Add PostgreSQL
3. Set variables on the web service:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | From the Postgres plugin |
| `BETTER_AUTH_URL` | `https://tours.wholesomehavensd.com` |
| `BETTER_AUTH_SECRET` | Long random string (keep private) |
| `VITE_AUTH_ENABLED` | `true` |

4. Custom domain: `tours.wholesomehavensd.com`
5. In Hostinger DNS, add the CNAME + TXT Railway shows for `tours`

Staff sign-in is `admin@wholesomehavensd.com` with the password you create on first visit.
