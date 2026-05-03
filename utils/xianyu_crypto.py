"""
闲鱼账号密码加密工具

设计要点：
- 每个用户可配置自己的加密密钥（任意字符串），由用户上传到后端并存入 users.xianyu_enc_key。
- 密文在数据库中以 ``ENC_PREFIX`` 前缀标识，便于区分历史明文。
- 未配置密钥时：密码按明文存储与返回（与旧行为完全兼容）。
- 密钥派生使用 scrypt（基于用户 id 作为 salt，保证不同用户即使密钥相同也产生不同 DEK）。
- 对称加密采用 ``cryptography.fernet.Fernet``（AES-128-CBC + HMAC-SHA256，附带时间戳）。
"""

from __future__ import annotations

import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

logger = logging.getLogger(__name__)

ENC_PREFIX = "enc::v1::"

# scrypt 参数（中等强度，避免 CLI 进程阻塞太久）
_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1


def is_encrypted(value: Optional[str]) -> bool:
    """判断字符串是否为已加密的密文。"""
    return bool(value) and isinstance(value, str) and value.startswith(ENC_PREFIX)


def _build_salt(user_id: int) -> bytes:
    # 使用 sha256("xianyu-enc-salt|<user_id>") 前 16 字节作为固定 salt
    raw = f"xianyu-enc-salt|{int(user_id)}".encode("utf-8")
    return hashlib.sha256(raw).digest()[:16]


def _derive_fernet_key(user_key: str, user_id: int) -> bytes:
    """将用户提供的任意字符串密钥派生为 Fernet 可用的 32 字节 urlsafe-base64 key。"""
    if not user_key:
        raise ValueError("user_key 不能为空")
    salt = _build_salt(user_id)
    kdf = Scrypt(salt=salt, length=32, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    raw_key = kdf.derive(user_key.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)


def _fernet(user_key: str, user_id: int) -> Fernet:
    return Fernet(_derive_fernet_key(user_key, user_id))


def encrypt_password(plain: Optional[str], user_key: Optional[str], user_id: int) -> str:
    """加密明文。若 ``user_key`` 为空或明文为空，则原样返回（不加密）。

    若传入的 plain 已经是密文格式，则直接返回以避免双重加密。
    """
    if plain is None:
        return ""
    if not user_key:
        return plain
    if is_encrypted(plain):
        return plain
    if plain == "":
        return ""
    try:
        token = _fernet(user_key, user_id).encrypt(plain.encode("utf-8"))
        return ENC_PREFIX + token.decode("ascii")
    except Exception as e:  # noqa: BLE001
        logger.error(f"加密闲鱼密码失败 (user_id={user_id}): {e}")
        # 不抛出，以免阻塞业务；但返回原值并打日志
        return plain


def decrypt_password(stored: Optional[str], user_key: Optional[str], user_id: int) -> str:
    """解密存储字段。

    - 若字段非密文（无前缀）：原样返回（兼容历史明文）。
    - 若字段是密文但未提供 ``user_key``：返回空串（上层可自行决定展示策略）。
    - 若解密失败：返回空串，避免把错误密钥派生出的垃圾字符当作密码使用。
    """
    if stored is None:
        return ""
    if not is_encrypted(stored):
        return stored
    if not user_key:
        logger.warning(f"发现加密密码但用户 {user_id} 未配置密钥，无法解密")
        return ""
    try:
        token = stored[len(ENC_PREFIX):].encode("ascii")
        return _fernet(user_key, user_id).decrypt(token).decode("utf-8")
    except (InvalidToken, Exception) as e:
        logger.error(f"解密闲鱼密码失败 (user_id={user_id}): {e}")
        return ""
