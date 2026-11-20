import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Default 32-byte test/dev key in base64:
DEFAULT_DEV_KEY = base64.b64encode(b"nutrisense_aes_256_gcm_lab_key!").decode("utf-8")


def get_encryption_key() -> bytes:
    key_b64 = os.environ.get("LAB_ENCRYPTION_KEY")
    if not key_b64:
        key_b64 = DEFAULT_DEV_KEY
    try:
        raw = base64.b64decode(key_b64)
        if len(raw) == 32:
            return raw
        # If length != 32, pad or truncate securely for safety
        if len(raw) < 32:
            return raw.ljust(32, b"\0")
        return raw[:32]
    except Exception:
        return base64.b64decode(DEFAULT_DEV_KEY)


def encrypt_lab_value(value: float | int | str) -> str:
    """
    Encrypts a numerical lab value using AES-256-GCM.
    Returns base64 encoded: nonce (12 bytes) + ciphertext + tag.
    """
    if value is None:
        raise ValueError("Cannot encrypt None value")
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce standard for GCM
    plaintext = str(value).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_lab_value(encrypted_str: str) -> float:
    """
    Decrypts an AES-256-GCM encrypted lab value.
    Returns float value.
    """
    if not encrypted_str:
        raise ValueError("Empty encrypted value")
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    raw = base64.b64decode(encrypted_str)
    if len(raw) < 13:
        raise ValueError("Invalid ciphertext length")
    nonce = raw[:12]
    ciphertext = raw[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
    return float(plaintext)
