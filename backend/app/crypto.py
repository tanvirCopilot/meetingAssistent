from __future__ import annotations

import base64
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class EncryptedBlob:
    algo: str
    salt_b64: str
    nonce_b64: str
    ciphertext_b64: str


def _require_crypto():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC  # type: ignore
        from cryptography.hazmat.primitives import hashes  # type: ignore
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            "Encryption requested but 'cryptography' is not installed. Install backend/requirements-crypto.txt"
        ) from e

    return AESGCM, PBKDF2HMAC, hashes


def encrypt_json(plaintext: str, passphrase: str) -> dict:
    AESGCM, PBKDF2HMAC, hashes = _require_crypto()

    if not passphrase:
        raise ValueError("passphrase required")

    salt = os.urandom(16)
    nonce = os.urandom(12)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=200_000,
    )
    key = kdf.derive(passphrase.encode("utf-8"))

    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)

    return {
        "_enc": {
            "algo": "AES-256-GCM+PBKDF2-SHA256",
            "salt": base64.b64encode(salt).decode("ascii"),
            "nonce": base64.b64encode(nonce).decode("ascii"),
            "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        }
    }


def decrypt_json(payload: dict, passphrase: str) -> str:
    AESGCM, PBKDF2HMAC, hashes = _require_crypto()

    enc = payload.get("_enc")
    if not isinstance(enc, dict):
        raise ValueError("not encrypted payload")

    salt = base64.b64decode(enc["salt"])
    nonce = base64.b64decode(enc["nonce"])
    ciphertext = base64.b64decode(enc["ciphertext"])

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=200_000,
    )
    key = kdf.derive(passphrase.encode("utf-8"))

    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
