import random
import string
import re

def slugify_name(name: str) -> str:
    # Lowercase, remove non-alphanumeric except spaces, replace spaces with dot
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s]", "", name)
    name = re.sub(r"\s+", ".", name.strip())
    return name

def generate_login_email(name: str, role: str) -> str:
    """Generates a login email like john.staff.a3f9@mabdel.ai"""
    slug_name = slugify_name(name)
    if not slug_name:
        slug_name = "user"
        
    random_hash = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    
    return f"{slug_name}.{role}.{random_hash}@mabdel.ai"

def generate_secure_password(length: int = 14) -> str:
    """Generates a secure password without ambiguous characters."""
    # Avoid l, 1, I, O, 0 for better readability
    upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    lower = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    symbols = "!@#$%^&*"
    
    all_chars = upper + lower + digits + symbols
    
    # Ensure at least one of each
    password = [
        random.choice(upper),
        random.choice(lower),
        random.choice(digits),
        random.choice(symbols)
    ]
    
    # Fill the rest
    password.extend(random.choice(all_chars) for _ in range(length - 4))
    
    # Shuffle
    random.shuffle(password)
    
    return "".join(password)
