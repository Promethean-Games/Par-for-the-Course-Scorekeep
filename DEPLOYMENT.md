# Deployment Guide

Par for the Course can be deployed to any platform that supports Node.js and PostgreSQL.

## Quick Deploy to Render

The easiest way to deploy is using Render's Blueprint feature:

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** → **Blueprint**
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml` and:
   - Create a web service running your app
   - Create a PostgreSQL database
   - Set up all required environment variables
   - Run database migrations on each deploy (via `preDeployCommand`)

That's it! Your app will be live in a few minutes.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Secret for session encryption (32+ chars) | Yes |
| `NODE_ENV` | Set to `production` for deployment | Yes |
| `PORT` | Server port (default: 5000) | No |

## Manual Deployment Options

### Docker

Build and run locally:

```bash
# Build the image
docker build -t par-for-the-course .

# Run with environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e SESSION_SECRET="your-secret-key-here" \
  par-for-the-course
```

### Any Node.js Host

1. Install dependencies: `npm ci`
2. Build: `npm run build`
3. Set environment variables
4. Push database schema: `npm run db:push`
5. Start: `npm start`

### Database Setup

Before first run, push the schema to your database:

```bash
DATABASE_URL="your-connection-string" npm run db:push
```

## Platform-Specific Notes

### Render
- Uses `render.yaml` for automatic configuration
- Free tier PostgreSQL available
- Auto-deploys on git push

### Railway
- Create a new project and add PostgreSQL
- Set environment variables in dashboard
- Deploy from GitHub

### Fly.io
- Create `fly.toml` configuration
- Use `fly postgres create` for database
- Deploy with `fly deploy`

### DigitalOcean App Platform
- Create app from GitHub
- Add managed PostgreSQL database
- Configure environment variables

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong `SESSION_SECRET` (32+ characters)
- [ ] Configure SSL for database connection
- [ ] Enable database backups
- [ ] Set up monitoring/logging

## Troubleshooting

**App won't start**: Check that `DATABASE_URL` is set correctly and the database is accessible.

**Database errors**: Run `npm run db:push` to ensure schema is up to date.

**Session issues**: Make sure `SESSION_SECRET` is set and consistent across deployments.
