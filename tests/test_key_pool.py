import time
from rezekify.agent.key_pool import RotaryKeyPool


def test_key_pool_rotates_on_rate_limit():
    keys = ["GEMINI_KEY_A", "GEMINI_KEY_B"]
    pool = RotaryKeyPool(keys=keys, cooldown_seconds=10)
    k1 = pool.get_current_key()
    assert k1 == "GEMINI_KEY_A"

    pool.report_rate_limit(k1)
    k2 = pool.get_current_key()
    assert k2 == "GEMINI_KEY_B"


def test_key_pool_cooldown_recovery():
    keys = ["KEY_1", "KEY_2"]
    pool = RotaryKeyPool(keys=keys, cooldown_seconds=1)
    k1 = pool.get_current_key()
    pool.report_rate_limit(k1)
    assert pool.get_current_key() == "KEY_2"

    pool.report_rate_limit("KEY_2")
    # Both are cooling down, should return the one expiring soonest (KEY_1)
    assert pool.get_current_key() == "KEY_1"


def test_key_pool_from_env(monkeypatch=None):
    import os

    os.environ["TEST_KEYS"] = " key_x , key_y , "
    try:
        pool = RotaryKeyPool.from_env("TEST_KEYS")
        assert pool.keys == ["key_x", "key_y"]
        assert pool.get_current_key() == "key_x"
    finally:
        del os.environ["TEST_KEYS"]


if __name__ == "__main__":
    test_key_pool_rotates_on_rate_limit()
    test_key_pool_cooldown_recovery()
    test_key_pool_from_env()
    print("All key_pool tests passed!")
