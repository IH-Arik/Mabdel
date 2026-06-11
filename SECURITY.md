# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest (master) | ✅ |
| Previous releases | ❌ |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please send an email to **security@mabdel.ai** with:

1. **Description** of the vulnerability
2. **Steps to reproduce** (proof-of-concept if possible)
3. **Potential impact** and severity assessment
4. **Suggested fix** (if you have one)

### What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Status Update**: Within 5 business days
- **Resolution Timeline**: Critical vulnerabilities patched within 7 days; high within 30 days

We will credit security researchers in our changelog unless you prefer to remain anonymous.

## Security Best Practices for Self-Hosting

- Change `SECRET_KEY` to a cryptographically random string (minimum 32 characters)
- Never commit `.env` files to version control
- Use HTTPS in production (TLS/SSL via Let's Encrypt)
- Restrict MongoDB access to localhost or VPN-only
- Set `ENVIRONMENT=production` and `DEBUG=false` in production
- Rotate JWT tokens and OAuth secrets regularly
- Enable rate limiting (`AUTH_RATE_LIMIT_MAX_REQUESTS`)
- Keep all dependencies up to date (`pip install -r requirements.txt --upgrade`)
