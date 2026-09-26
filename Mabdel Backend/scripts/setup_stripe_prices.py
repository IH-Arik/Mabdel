"""Create (or reuse) GoCustify's three monthly subscription prices in Stripe.

Run on the server where the Stripe key lives (from the Mabdel Backend directory):

    python -m scripts.setup_stripe_prices            # uses STRIPE_SECRET_KEY from .env
    python -m scripts.setup_stripe_prices --yes      # required when the key is a LIVE key

It is idempotent: each price is found by its lookup_key (gocustify_<tier>_monthly), so
running it again reuses what exists instead of creating duplicates. It prints the
STRIPE_PRICE_* lines to paste into .env.
"""

from __future__ import annotations

import argparse
import sys

import stripe

from app.core.config import settings

# Same figures the /subscription page shows.
TIERS = [
    ("starter", "GoCustify Starter", 29900),
    ("growth", "GoCustify Growth", 69900),
    ("pro", "GoCustify Pro", 99900),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--key", help="Stripe secret key (defaults to STRIPE_SECRET_KEY from the environment/.env)")
    parser.add_argument("--yes", action="store_true", help="confirm you mean to create products in LIVE mode")
    args = parser.parse_args()

    key = args.key or settings.STRIPE_SECRET_KEY
    if not key:
        print("No Stripe key: set STRIPE_SECRET_KEY or pass --key.", file=sys.stderr)
        return 1

    live = key.startswith(("sk_live_", "rk_live_"))
    print(f"Stripe mode: {'LIVE' if live else 'TEST'}")
    if live and not args.yes:
        print("This is a LIVE key. Re-run with --yes to create the products/prices for real.", file=sys.stderr)
        return 2

    client = stripe.StripeClient(key)
    env_lines: list[str] = []
    for tier, name, amount in TIERS:
        lookup_key = f"gocustify_{tier}_monthly"
        existing = client.prices.list(params={"lookup_keys": [lookup_key], "active": True, "limit": 1}).data
        if existing:
            price = existing[0]
            note = "reused"
            if price.unit_amount != amount:
                # Stripe prices are immutable; never silently charge a different amount.
                print(
                    f"WARNING: {lookup_key} exists but is {price.unit_amount} cents, expected {amount}. "
                    "Archive it in the dashboard and re-run to create the right one.",
                    file=sys.stderr,
                )
        else:
            product = client.products.create(params={"name": name, "metadata": {"gocustify_tier": tier}})
            price = client.prices.create(
                params={
                    "product": product.id,
                    "currency": "usd",
                    "unit_amount": amount,
                    "recurring": {"interval": "month"},
                    "lookup_key": lookup_key,
                }
            )
            note = "created"
        print(f"{tier:8s} {note:8s} {price.id}  (${price.unit_amount / 100:.0f}/month)")
        env_lines.append(f"STRIPE_PRICE_{tier.upper()}={price.id}")

    print("\nAdd these to the backend .env, then recreate the api container:\n")
    print("\n".join(env_lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
