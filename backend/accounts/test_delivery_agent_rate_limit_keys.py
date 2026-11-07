import hashlib
import hmac
from django.test import TestCase, override_settings

from accounts.rate_limit_keys import (
    ClientIPResolutionError,
    DigestVersionPair,
    IDENTIFIER_LOCK_NAMESPACE,
    IP_LOCK_NAMESPACE,
    RateLimitKeyConfigurationError,
    advisory_lock_token,
    canonicalize_identifier,
    canonicalize_ip_address,
    digest_pairs_for_canonical_value,
    identifier_digest_pairs,
    ip_digest_pairs,
    resolve_trusted_client_ip,
)


TEST_SETTINGS = {
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET": "current-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION": "v2",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "previous-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v1",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": "stable-advisory-lock-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS": [],
}


@override_settings(**TEST_SETTINGS)
class RateLimitKeyUtilityTests(TestCase):
    def test_phone_normalization_uses_existing_helper(self):
        self.assertEqual(
            canonicalize_identifier(" 987 654 3210 "),
            "identifier:phone:+919876543210",
        )
        self.assertEqual(
            canonicalize_identifier("0091-9876543210"),
            "identifier:phone:+919876543210",
        )

    def test_agent_ids_are_case_insensitive_and_trimmed(self):
        self.assertEqual(
            canonicalize_identifier(" vc-agt-00001 "),
            "identifier:agent:VC-AGT-00001",
        )

    def test_unknown_identifiers_are_deterministic_and_namespaced(self):
        first = canonicalize_identifier("  Unknown Agent ")
        second = canonicalize_identifier("unknown agent")

        self.assertEqual(first, second)
        self.assertEqual(first, "identifier:unknown:unknown agent")

    def test_identifier_namespaces_remain_distinct(self):
        self.assertNotEqual(
            canonicalize_identifier("VC-AGT-00001"),
            canonicalize_identifier("9876543210"),
        )
        self.assertNotEqual(
            canonicalize_identifier("9876543210"),
            canonicalize_identifier("9876543210-invalid"),
        )

    def test_malformed_phone_does_not_become_a_phone_identifier(self):
        canonical = canonicalize_identifier("+91 12345")

        self.assertTrue(canonical.startswith("identifier:unknown:"))
        self.assertNotIn("identifier:phone:", canonical)

    def test_unicode_and_surrounding_whitespace_are_deterministic(self):
        self.assertEqual(
            canonicalize_identifier("  ＡＧＥＮＴ  "),
            canonicalize_identifier("agent"),
        )

    def test_digest_pairs_have_expected_format_and_versions(self):
        pairs = identifier_digest_pairs("VC-AGT-00001")

        self.assertEqual(
            pairs,
            (
                DigestVersionPair(
                    digest=hmac.new(
                        b"current-rate-limit-secret-0123456789",
                        b"identifier:agent:VC-AGT-00001",
                        hashlib.sha256,
                    ).hexdigest(),
                    key_version="v2",
                ),
                DigestVersionPair(
                    digest=hmac.new(
                        b"previous-rate-limit-secret-0123456789",
                        b"identifier:agent:VC-AGT-00001",
                        hashlib.sha256,
                    ).hexdigest(),
                    key_version="v1",
                ),
            ),
        )
        self.assertTrue(all(len(pair.digest) == 64 for pair in pairs))
        self.assertTrue(all(pair.digest == pair.digest.lower() for pair in pairs))

    def test_different_inputs_produce_different_digests(self):
        first = identifier_digest_pairs("VC-AGT-00001")[0]
        second = identifier_digest_pairs("VC-AGT-00002")[0]

        self.assertNotEqual(first.digest, second.digest)

    def test_missing_previous_key_returns_only_current_pair(self):
        settings = {
            **TEST_SETTINGS,
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "",
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "",
        }

        with override_settings(**settings):
            pairs = ip_digest_pairs("2001:db8::1")

        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0].key_version, "v2")

    def test_incomplete_key_configuration_fails_without_exposing_secret(self):
        settings = {
            **TEST_SETTINGS,
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "",
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v1",
        }

        with override_settings(**settings):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                identifier_digest_pairs("VC-AGT-00001")

        self.assertNotIn("previous-rate-limit-secret-0123456789", str(context.exception))

    def test_current_hmac_secret_must_be_at_least_32_utf8_bytes(self):
        short_secret = "c" * 31

        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET": short_secret,
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                identifier_digest_pairs("VC-AGT-00001")

        self.assertNotIn(short_secret, str(context.exception))

    def test_previous_hmac_secret_must_be_at_least_32_utf8_bytes(self):
        short_secret = "p" * 31

        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": short_secret,
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                identifier_digest_pairs("VC-AGT-00001")

        self.assertNotIn(short_secret, str(context.exception))

    def test_lock_secret_must_be_at_least_32_utf8_bytes(self):
        short_secret = "l" * 31

        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": short_secret,
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                advisory_lock_token(
                    canonicalize_identifier("VC-AGT-00001"),
                    IDENTIFIER_LOCK_NAMESPACE,
                )

        self.assertNotIn(short_secret, str(context.exception))

    def test_current_and_previous_hmac_secrets_must_differ(self):
        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": (
                    TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET"]
                ),
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                identifier_digest_pairs("VC-AGT-00001")

        self.assertNotIn(
            TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET"],
            str(context.exception),
        )

    def test_current_and_previous_key_versions_must_differ(self):
        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v2",
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError) as context:
                identifier_digest_pairs("VC-AGT-00001")

        self.assertNotIn("v2", str(context.exception))

    def test_whitespace_only_key_versions_are_rejected(self):
        for setting_name in (
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION",
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION",
        ):
            with self.subTest(setting_name=setting_name):
                settings = {
                    **TEST_SETTINGS,
                    setting_name: " \t ",
                }
                with override_settings(**settings):
                    with self.assertRaises(RateLimitKeyConfigurationError):
                        identifier_digest_pairs("VC-AGT-00001")

    def test_key_versions_must_not_exceed_32_characters(self):
        for setting_name in (
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION",
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION",
        ):
            with self.subTest(setting_name=setting_name):
                settings = {
                    **TEST_SETTINGS,
                    setting_name: "v" * 33,
                }
                with override_settings(**settings):
                    with self.assertRaises(RateLimitKeyConfigurationError):
                        identifier_digest_pairs("VC-AGT-00001")

    def test_identifier_and_ip_digest_domains_are_separate(self):
        identifier_pair = identifier_digest_pairs("VC-AGT-00001")[0]
        ip_pair = ip_digest_pairs("203.0.113.10")[0]

        self.assertNotEqual(identifier_pair.digest, ip_pair.digest)

    def test_lock_tokens_are_deterministic_and_namespaced(self):
        canonical = canonicalize_identifier("VC-AGT-00001")

        first = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)
        second = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)
        ip_token = advisory_lock_token(canonical, IP_LOCK_NAMESPACE)

        self.assertEqual(first, second)
        self.assertEqual(first, -1169180945685862562)
        self.assertNotEqual(first, ip_token)
        self.assertGreaterEqual(first, -(1 << 63))
        self.assertLess(first, 1 << 63)

    def test_lock_tokens_do_not_change_when_hmac_keys_rotate(self):
        canonical = canonicalize_identifier("VC-AGT-00001")
        original = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)

        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET": "rotated-current-rate-limit-secret-0123456789",
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION": "v3",
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "current-rate-limit-secret-0123456789",
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v2",
            }
        ):
            rotated = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)

        self.assertEqual(original, rotated)

    def test_lock_secret_must_be_separate(self):
        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": "current-rate-limit-secret-0123456789",
            }
        ):
            with self.assertRaises(RateLimitKeyConfigurationError):
                advisory_lock_token(
                    canonicalize_identifier("VC-AGT-00001"),
                    IDENTIFIER_LOCK_NAMESPACE,
                )

    def test_lock_secret_changes_lock_tokens(self):
        canonical = canonicalize_identifier("VC-AGT-00001")
        original = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)

        with override_settings(
            **{
                **TEST_SETTINGS,
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": "new-stable-lock-secret-0123456789",
            }
        ):
            changed = advisory_lock_token(canonical, IDENTIFIER_LOCK_NAMESPACE)

        self.assertNotEqual(original, changed)

    def test_direct_valid_ips_ignore_forwarded_headers(self):
        request = type(
            "Request",
            (),
            {
                "META": {
                    "REMOTE_ADDR": "203.0.113.10",
                    "HTTP_X_FORWARDED_FOR": "198.51.100.10",
                }
            },
        )()

        self.assertEqual(resolve_trusted_client_ip(request), "203.0.113.10")

    def test_valid_direct_ipv4_and_ipv6_are_canonicalized(self):
        self.assertEqual(canonicalize_ip_address("203.0.113.10"), "ip:4:203.0.113.10")
        self.assertEqual(canonicalize_ip_address("2001:0DB8:0:0::1"), "ip:6:2001:db8::1")
        self.assertEqual(
            canonicalize_ip_address("::ffff:203.0.113.10"),
            "ip:4:203.0.113.10",
        )

    def test_trusted_proxy_chain_selects_rightmost_untrusted_address(self):
        request = type(
            "Request",
            (),
            {
                "META": {
                    "REMOTE_ADDR": "10.0.0.2",
                    "HTTP_X_FORWARDED_FOR": (
                        "198.51.100.10, 10.0.0.1, 10.0.0.2"
                    ),
                }
            },
        )()

        with override_settings(
            DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS=["10.0.0.0/8"]
        ):
            self.assertEqual(resolve_trusted_client_ip(request), "198.51.100.10")

    def test_trusted_proxy_requires_a_valid_forwarded_chain(self):
        for forwarded_for in (None, "", "not-an-ip", "198.51.100.10, ,10.0.0.2"):
            request = type(
                "Request",
                (),
                {
                    "META": {
                        "REMOTE_ADDR": "10.0.0.2",
                        "HTTP_X_FORWARDED_FOR": forwarded_for,
                    }
                },
            )()

            with self.subTest(forwarded_for=forwarded_for):
                with override_settings(
                    DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS=["10.0.0.0/8"]
                ):
                    with self.assertRaises(ClientIPResolutionError):
                        resolve_trusted_client_ip(request)

    def test_missing_or_malformed_remote_addr_fails_closed(self):
        for remote_addr in (None, "", "not-an-ip"):
            request = type(
                "Request",
                (),
                {"META": {"REMOTE_ADDR": remote_addr}},
            )()

            with self.subTest(remote_addr=remote_addr):
                with self.assertRaises(ClientIPResolutionError):
                    resolve_trusted_client_ip(request)

    def test_ip_errors_do_not_expose_raw_addresses(self):
        raw_address = "203.0.113.99"
        with self.assertRaises(ClientIPResolutionError) as context:
            canonicalize_ip_address(raw_address + "-invalid")

        self.assertNotIn(raw_address, str(context.exception))

    def test_email_verification_digest_pairs_domain_separation(self):
        canonical_id = canonicalize_identifier("VC-AGT-00001")
        login_pairs = identifier_digest_pairs(canonical_id)
        ev_pairs = digest_pairs_for_canonical_value(f"email_verify:{canonical_id}")

        self.assertEqual(len(login_pairs), 2)
        self.assertEqual(len(ev_pairs), 2)
        # Login and email verification digests must be completely disjoint
        self.assertNotEqual(login_pairs[0].digest, ev_pairs[0].digest)
        self.assertNotEqual(login_pairs[1].digest, ev_pairs[1].digest)
        # Key versions must align
        self.assertEqual(login_pairs[0].key_version, ev_pairs[0].key_version)
        self.assertEqual(login_pairs[1].key_version, ev_pairs[1].key_version)

    def test_email_verification_ip_digest_pairs_domain_separation(self):
        canonical_ip = "127.0.0.1"
        login_pairs = ip_digest_pairs(canonical_ip)
        ev_pairs = digest_pairs_for_canonical_value(f"email_verify:{canonical_ip}")

        self.assertNotEqual(login_pairs[0].digest, ev_pairs[0].digest)
        self.assertNotEqual(login_pairs[1].digest, ev_pairs[1].digest)

    def test_digest_pairs_for_canonical_value_key_rotation(self):
        canonical_val = "email_verify:identifier:agent:VC-AGT-00002"
        pairs = digest_pairs_for_canonical_value(canonical_val)

        self.assertEqual(len(pairs), 2)
        expected_curr = hmac.new(
            TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET"].encode("utf-8"),
            canonical_val.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        expected_prev = hmac.new(
            TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET"].encode("utf-8"),
            canonical_val.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        self.assertEqual(pairs[0].digest, expected_curr)
        self.assertEqual(pairs[0].key_version, "v2")
        self.assertEqual(pairs[1].digest, expected_prev)
        self.assertEqual(pairs[1].key_version, "v1")

    def test_email_verification_advisory_lock_token_separation(self):
        canonical_id = canonicalize_identifier("VC-AGT-00001")
        login_token = advisory_lock_token(canonical_id, IDENTIFIER_LOCK_NAMESPACE)
        ev_token = advisory_lock_token(f"email_verify:{canonical_id}", IDENTIFIER_LOCK_NAMESPACE)

        self.assertNotEqual(login_token, ev_token)
        # Must be valid signed 64-bit integer
        self.assertTrue(-(1 << 63) <= ev_token < (1 << 63))
